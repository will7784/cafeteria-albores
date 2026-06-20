from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'cafeteria-secret-key-2024')

# Database config: usa PostgreSQL en producción (Railway), SQLite en local
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://')
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cafeteria.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# ===== MODELOS =====
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_superuser = db.Column(db.Integer, default=0)
    activo = db.Column(db.Integer, default=1)
    created_at = db.Column(db.String(50), default=lambda: datetime.now().isoformat())

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Categoria(db.Model):
    __tablename__ = 'categorias'
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    es_vueltas = db.Column(db.Integer, default=0)
    activo = db.Column(db.Integer, default=1)

class Bolsillo(db.Model):
    __tablename__ = 'bolsillos'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    icono = db.Column(db.String(10), default='💵')
    orden = db.Column(db.Integer, default=0)
    activo = db.Column(db.Integer, default=1)

class Transaccion(db.Model):
    __tablename__ = 'transacciones'
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False)
    bolsillo = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    subcategoria = db.Column(db.String(100))
    monto = db.Column(db.Float, nullable=False)
    descripcion = db.Column(db.String(255))
    fecha_hora = db.Column(db.String(50), nullable=False)
    fecha = db.Column(db.String(10), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ===== INIT DB =====
def seed_data():
    if Categoria.query.count() == 0:
        categorias_default = [
            Categoria(tipo='ingreso', nombre='Ventas del día'),
            Categoria(tipo='ingreso', nombre='Ventas día anterior'),
            Categoria(tipo='ingreso', nombre='Préstamo'),
            Categoria(tipo='ingreso', nombre='Otros ingresos'),
            Categoria(tipo='egreso', nombre='Insumos'),
            Categoria(tipo='egreso', nombre='Nómina'),
            Categoria(tipo='egreso', nombre='Servicios públicos'),
            Categoria(tipo='egreso', nombre='Arriendo'),
            Categoria(tipo='egreso', nombre='Otros egresos'),
        ]
        db.session.add_all(categorias_default)
        db.session.commit()
    
    if Bolsillo.query.count() == 0:
        bolsillos_default = [
            Bolsillo(nombre='Efectivo', icono='💵', orden=1),
            Bolsillo(nombre='Nequi', icono='📱', orden=2),
            Bolsillo(nombre='Bancolombia', icono='🏦', orden=3),
        ]
        db.session.add_all(bolsillos_default)
        db.session.commit()
    
    # Crear superusuario por defecto si no existe
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', is_superuser=1)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()

with app.app_context():
    db.create_all()
    seed_data()

# ===== AUTH ROUTES =====
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        user = User.query.filter_by(username=username, activo=1).first()
        
        if user and user.check_password(password):
            login_user(user)
            return jsonify({'success': True, 'is_superuser': user.is_superuser})
        
        return jsonify({'success': False, 'error': 'Usuario o contraseña incorrectos'})
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/api/auth/check')
def auth_check():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, 'username': current_user.username, 'is_superuser': current_user.is_superuser})
    return jsonify({'authenticated': False})

# ===== USERS MANAGEMENT (solo superuser) =====
@app.route('/api/users')
@login_required
def get_users():
    if not current_user.is_superuser:
        return jsonify({'success': False, 'error': 'No autorizado'}), 403
    
    users = User.query.all()
    return jsonify([{'id': u.id, 'username': u.username, 'is_superuser': u.is_superuser, 'activo': u.activo} for u in users])

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    if not current_user.is_superuser:
        return jsonify({'success': False, 'error': 'No autorizado'}), 403
    
    data = request.json
    username = data.get('username')
    password = data.get('password')
    is_superuser = data.get('is_superuser', 0)
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Usuario y contraseña requeridos'})
    
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'error': 'El usuario ya existe'})
    
    new_user = User(username=username, is_superuser=is_superuser)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'success': True, 'id': new_user.id})

@app.route('/api/users/<int:id>', methods=['DELETE'])
@login_required
def delete_user(id):
    if not current_user.is_superuser:
        return jsonify({'success': False, 'error': 'No autorizado'}), 403
    
    user = User.query.get(id)
    if not user:
        return jsonify({'success': False, 'error': 'Usuario no encontrado'})
    
    if user.id == current_user.id:
        return jsonify({'success': False, 'error': 'No puedes eliminar tu propio usuario'})
    
    user.activo = 0
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/users/cambiar-password', methods=['POST'])
@login_required
def cambiar_password():
    data = request.json
    password_actual = data.get('password_actual')
    password_nueva = data.get('password_nueva')
    
    if not password_actual or not password_nueva:
        return jsonify({'success': False, 'error': 'Contraseña actual y nueva requeridas'})
    
    if len(password_nueva) < 4:
        return jsonify({'success': False, 'error': 'La nueva contraseña debe tener al menos 4 caracteres'})
    
    if not current_user.check_password(password_actual):
        return jsonify({'success': False, 'error': 'Contraseña actual incorrecta'})
    
    current_user.set_password(password_nueva)
    db.session.commit()
    return jsonify({'success': True})

# ===== MAIN APP =====
@app.route('/')
@login_required
def index():
    return render_template('index.html')

# ===== BOLSILLOS =====
@app.route('/api/bolsillos')
@login_required
def get_bolsillos():
    bolsillos = Bolsillo.query.filter_by(activo=1).order_by(Bolsillo.orden, Bolsillo.id).all()
    return jsonify([{'id': b.id, 'nombre': b.nombre, 'icono': b.icono, 'activo': b.activo} for b in bolsillos])

@app.route('/api/bolsillos', methods=['POST'])
@login_required
def crear_bolsillo():
    data = request.json
    nuevo = Bolsillo(nombre=data['nombre'], icono=data.get('icono', '💵'))
    db.session.add(nuevo)
    db.session.commit()
    return jsonify({'success': True, 'id': nuevo.id})

@app.route('/api/bolsillos/<int:id>', methods=['DELETE'])
@login_required
def eliminar_bolsillo(id):
    tiene = Transaccion.query.filter_by(bolsillo=Bolsillo.query.get(id).nombre).count()
    if tiene > 0:
        return jsonify({'success': False, 'error': 'No se puede eliminar: tiene transacciones asociadas'})
    b = Bolsillo.query.get(id)
    db.session.delete(b)
    db.session.commit()
    return jsonify({'success': True})

# ===== CATEGORÍAS =====
@app.route('/api/categorias')
@login_required
def get_categorias():
    tipo = request.args.get('tipo', 'ingreso')
    categorias = Categoria.query.filter_by(tipo=tipo, activo=1).order_by(Categoria.nombre).all()
    return jsonify([{'id': c.id, 'tipo': c.tipo, 'nombre': c.nombre, 'es_vueltas': c.es_vueltas} for c in categorias])

@app.route('/api/categorias/all')
@login_required
def get_all_categorias():
    categorias = Categoria.query.order_by(Categoria.tipo, Categoria.nombre).all()
    return jsonify([{'id': c.id, 'tipo': c.tipo, 'nombre': c.nombre, 'es_vueltas': c.es_vueltas} for c in categorias])

@app.route('/api/categorias', methods=['POST'])
@login_required
def crear_categoria():
    data = request.json
    nueva = Categoria(tipo=data['tipo'], nombre=data['nombre'], es_vueltas=data.get('es_vueltas', 0))
    db.session.add(nueva)
    db.session.commit()
    return jsonify({'success': True, 'id': nueva.id})

@app.route('/api/categorias/<int:id>', methods=['DELETE'])
@login_required
def eliminar_categoria(id):
    cat = Categoria.query.get(id)
    tiene = Transaccion.query.filter_by(categoria=cat.nombre).count()
    if tiene > 0:
        return jsonify({'success': False, 'error': 'No se puede eliminar: tiene transacciones asociadas'})
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'success': True})

# ===== TRANSACCIONES =====
@app.route('/api/transacciones', methods=['POST'])
@login_required
def crear_transaccion():
    data = request.json
    now = datetime.now()
    
    nueva = Transaccion(
        tipo=data['tipo'],
        bolsillo=data['bolsillo'],
        categoria=data['categoria'],
        subcategoria=data.get('subcategoria'),
        monto=data['monto'],
        descripcion=data.get('descripcion', ''),
        fecha_hora=now.isoformat(),
        fecha=now.strftime('%Y-%m-%d'),
        user_id=current_user.id
    )
    db.session.add(nueva)
    db.session.commit()
    
    return jsonify({'success': True, 'id': nueva.id})

@app.route('/api/transacciones/<int:id>', methods=['DELETE'])
@login_required
def eliminar_transaccion(id):
    t = Transaccion.query.get(id)
    if not t:
        return jsonify({'success': False, 'error': 'Transacción no encontrada'})
    db.session.delete(t)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/transacciones/<int:id>', methods=['PUT'])
@login_required
def editar_transaccion(id):
    data = request.json
    t = Transaccion.query.get(id)
    if not t:
        return jsonify({'success': False, 'error': 'Transacción no encontrada'})
    
    t.tipo = data.get('tipo', t.tipo)
    t.bolsillo = data.get('bolsillo', t.bolsillo)
    t.categoria = data.get('categoria', t.categoria)
    t.subcategoria = data.get('subcategoria', t.subcategoria)
    t.monto = data.get('monto', t.monto)
    t.descripcion = data.get('descripcion', t.descripcion)
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/resumen-diario')
@login_required
def resumen_diario():
    fecha = request.args.get('fecha', datetime.now().strftime('%Y-%m-%d'))
    
    from sqlalchemy import func, case
    
    ingresos = db.session.query(
        Transaccion.bolsillo,
        Transaccion.categoria,
        Transaccion.subcategoria,
        func.sum(Transaccion.monto).label('total'),
        func.count(Transaccion.id).label('cantidad')
    ).filter(Transaccion.tipo == 'ingreso', Transaccion.fecha == fecha
    ).group_by(Transaccion.bolsillo, Transaccion.categoria, Transaccion.subcategoria).all()
    
    egresos = db.session.query(
        Transaccion.bolsillo,
        Transaccion.categoria,
        Transaccion.subcategoria,
        func.sum(Transaccion.monto).label('total'),
        func.count(Transaccion.id).label('cantidad')
    ).filter(Transaccion.tipo == 'egreso', Transaccion.fecha == fecha
    ).group_by(Transaccion.bolsillo, Transaccion.categoria, Transaccion.subcategoria).all()
    
    bolsillos = db.session.query(
        Transaccion.bolsillo,
        (func.sum(case((Transaccion.tipo == 'ingreso', Transaccion.monto), else_=0)) - 
         func.sum(case((Transaccion.tipo == 'egreso', Transaccion.monto), else_=0))).label('saldo')
    ).group_by(Transaccion.bolsillo).all()
    
    return jsonify({
        'fecha': fecha,
        'ingresos': [{'bolsillo': i.bolsillo, 'categoria': i.categoria, 'subcategoria': i.subcategoria, 'total': i.total, 'cantidad': i.cantidad} for i in ingresos],
        'egresos': [{'bolsillo': e.bolsillo, 'categoria': e.categoria, 'subcategoria': e.subcategoria, 'total': e.total, 'cantidad': e.cantidad} for e in egresos],
        'bolsillos': [{'bolsillo': b.bolsillo, 'saldo': b.saldo} for b in bolsillos],
        'total_ingresos': sum(i.total for i in ingresos),
        'total_egresos': sum(e.total for e in egresos)
    })

@app.route('/api/reporte-mensual')
@login_required
def reporte_mensual():
    mes = request.args.get('mes', datetime.now().strftime('%Y-%m'))
    
    from sqlalchemy import func
    
    ingresos_mes = db.session.query(
        Transaccion.fecha,
        func.sum(Transaccion.monto).label('total')
    ).filter(Transaccion.tipo == 'ingreso', Transaccion.fecha.like(f'{mes}%')
    ).group_by(Transaccion.fecha).order_by(Transaccion.fecha).all()
    
    egresos_mes = db.session.query(
        Transaccion.fecha,
        func.sum(Transaccion.monto).label('total')
    ).filter(Transaccion.tipo == 'egreso', Transaccion.fecha.like(f'{mes}%')
    ).group_by(Transaccion.fecha).order_by(Transaccion.fecha).all()
    
    ingresos_categoria = db.session.query(
        Transaccion.categoria,
        func.sum(Transaccion.monto).label('total')
    ).filter(Transaccion.tipo == 'ingreso', Transaccion.fecha.like(f'{mes}%')
    ).group_by(Transaccion.categoria).all()
    
    egresos_categoria = db.session.query(
        Transaccion.categoria,
        func.sum(Transaccion.monto).label('total')
    ).filter(Transaccion.tipo == 'egreso', Transaccion.fecha.like(f'{mes}%')
    ).group_by(Transaccion.categoria).all()
    
    ingresos_bolsillo = db.session.query(
        Transaccion.bolsillo,
        func.sum(Transaccion.monto).label('total')
    ).filter(Transaccion.tipo == 'ingreso', Transaccion.fecha.like(f'{mes}%')
    ).group_by(Transaccion.bolsillo).all()
    
    egresos_bolsillo = db.session.query(
        Transaccion.bolsillo,
        func.sum(Transaccion.monto).label('total')
    ).filter(Transaccion.tipo == 'egreso', Transaccion.fecha.like(f'{mes}%')
    ).group_by(Transaccion.bolsillo).all()
    
    return jsonify({
        'mes': mes,
        'ingresos_diarios': [{'fecha': i.fecha, 'total': i.total} for i in ingresos_mes],
        'egresos_diarios': [{'fecha': e.fecha, 'total': e.total} for e in egresos_mes],
        'ingresos_categoria': [{'categoria': i.categoria, 'total': i.total} for i in ingresos_categoria],
        'egresos_categoria': [{'categoria': e.categoria, 'total': e.total} for e in egresos_categoria],
        'ingresos_bolsillo': [{'bolsillo': i.bolsillo, 'total': i.total} for i in ingresos_bolsillo],
        'egresos_bolsillo': [{'bolsillo': e.bolsillo, 'total': e.total} for e in egresos_bolsillo],
        'total_ingresos': sum(i.total for i in ingresos_mes),
        'total_egresos': sum(e.total for e in egresos_mes)
    })

@app.route('/api/transacciones/recent')
@login_required
def transacciones_recent():
    fecha = request.args.get('fecha', datetime.now().strftime('%Y-%m-%d'))
    transacciones = Transaccion.query.filter_by(fecha=fecha).order_by(Transaccion.fecha_hora.desc()).limit(50).all()
    return jsonify([{
        'id': t.id,
        'tipo': t.tipo,
        'bolsillo': t.bolsillo,
        'categoria': t.categoria,
        'subcategoria': t.subcategoria,
        'monto': t.monto,
        'descripcion': t.descripcion,
        'fecha_hora': t.fecha_hora,
        'fecha': t.fecha
    } for t in transacciones])

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
