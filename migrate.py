from app import app, db
from app import seed_data

with app.app_context():
    print("Creando tablas...")
    db.create_all()
    print("Tablas creadas.")
    
    print("Insertando datos por defecto...")
    seed_data()
    print("Datos insertados.")
    
    # Verificar que el superusuario existe
    from app import User
    admin = User.query.filter_by(username='admin').first()
    if admin:
        print(f"✅ Superusuario 'admin' verificado (ID: {admin.id})")
    else:
        print("❌ Error: No se encontró el superusuario")
    
    print("\n✅ Migración completada exitosamente!")
