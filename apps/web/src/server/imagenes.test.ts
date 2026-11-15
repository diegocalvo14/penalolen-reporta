import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { detectarFormato, ImagenInvalidaError, procesarImagen } from './imagenes';

async function imagen(formato: 'jpeg' | 'png' | 'webp', ancho = 64, alto = 48) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: '#7a7a7a' } })
    .toFormat(formato)
    .toBuffer();
}

describe('detectarFormato', () => {
  it('reconoce JPEG, PNG y WEBP por su firma', async () => {
    expect(detectarFormato(await imagen('jpeg'))).toBe('jpeg');
    expect(detectarFormato(await imagen('png'))).toBe('png');
    expect(detectarFormato(await imagen('webp'))).toBe('webp');
  });

  it('no se deja engañar por texto o GIF', () => {
    expect(detectarFormato(Buffer.from('hola, soy un .jpg'))).toBeNull();
    expect(detectarFormato(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectarFormato(Buffer.alloc(0))).toBeNull();
  });
});

describe('procesarImagen (RF-3.1 y RF-11.2)', () => {
  it('normaliza a JPEG y devuelve dimensiones', async () => {
    const r = await procesarImagen(await imagen('png', 80, 60));
    expect(r.mime).toBe('image/jpeg');
    expect(detectarFormato(r.buffer)).toBe('jpeg');
    expect([r.ancho, r.alto]).toEqual([80, 60]);
    expect(r.formatoOriginal).toBe('png');
  });

  it('reduce fotos grandes a 2048 px por lado', async () => {
    const r = await procesarImagen(await imagen('jpeg', 4000, 3000));
    expect(r.ancho).toBe(2048);
    expect(r.alto).toBe(1536);
  });

  it('elimina los metadatos EXIF (ubicación, modelo del celular)', async () => {
    const conExif = await sharp(await imagen('jpeg'))
      .withExif({ IFD0: { Make: 'CelularDePrueba', Artist: 'Vecino Ejemplo' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(conExif).metadata()).exif).toBeDefined();

    const r = await procesarImagen(conExif);
    expect((await sharp(r.buffer).metadata()).exif).toBeUndefined();
  });

  it('rechaza archivos que no son imágenes o están dañados', async () => {
    await expect(procesarImagen(Buffer.from('texto plano'))).rejects.toBeInstanceOf(ImagenInvalidaError);
    const jpg = await imagen('jpeg', 300, 300);
    const truncado = jpg.subarray(0, Math.floor(jpg.length / 3));
    await expect(procesarImagen(truncado)).rejects.toBeInstanceOf(ImagenInvalidaError);
    await expect(procesarImagen(Buffer.alloc(0))).rejects.toBeInstanceOf(ImagenInvalidaError);
  });

  it('rechaza archivos de más de 10 MB', async () => {
    const grande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10 * 1024 * 1024)]);
    await expect(procesarImagen(grande)).rejects.toThrow('10 MB');
  });
});
