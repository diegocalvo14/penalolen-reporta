# HTTPS en la red local (para el GPS del celular)

El navegador del celular solo entrega el GPS en páginas **HTTPS** (o en `localhost`).
Sin HTTPS la app funciona igual: el encargado marca el punto en el mapa (RF-3.4).
Para usar el GPS real en la demo:

## 1. Crear los certificados (una vez, en el PC de la demo)

```powershell
winget install FiloSottile.mkcert
mkcert -install                       # crea una autoridad local y la marca como confiable en Windows
ipconfig                              # anota la IPv4 del PC en el Wi-Fi, por ejemplo 192.168.1.20
cd infra\certs
mkcert -key-file clave.pem -cert-file certificado.pem 192.168.1.20 localhost 127.0.0.1
```

Si la IP del PC cambia (otra red Wi-Fi), repite el último comando con la nueva IP.

## 2. Levantar la web con HTTPS

```powershell
cd apps\web
npm run dev:https
```

En `apps\web\.env` agrega la IP a `DEV_ALLOWED_ORIGINS=192.168.1.20`.

## 3. Confiar en el certificado desde el celular

1. En el PC, `mkcert -CAROOT` muestra la carpeta donde está `rootCA.pem`.
2. Copia `rootCA.pem` al celular (por cable, correo o Drive).
3. **Android:** Ajustes → Seguridad → Más ajustes → Cifrado y credenciales → Instalar un certificado → Certificado de CA.
   **iPhone:** abre el archivo, instala el perfil y luego activa la confianza total en Ajustes → General → Información → Ajustes de confianza de certificados.
4. Abre `https://192.168.1.20:3000` en el celular: no debería aparecer ninguna advertencia, y el formulario debería mostrar "GPS · precisión ±N m".

`clave.pem`, `certificado.pem` y `rootCA.pem` no se suben a git (están en `.gitignore`).
Tras la demo, puedes borrar el certificado de CA del celular.
