const SIGNATURE_CONTRAST = 1.8;
const NEAR_WHITE_THRESHOLD = 248;

export function darkenSignaturePixels(pixels: Uint8ClampedArray): void {
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

    if (alpha === 0 || luminance >= NEAR_WHITE_THRESHOLD) continue;

    pixels[index] = Math.max(0, 255 - (255 - red) * SIGNATURE_CONTRAST);
    pixels[index + 1] = Math.max(0, 255 - (255 - green) * SIGNATURE_CONTRAST);
    pixels[index + 2] = Math.max(0, 255 - (255 - blue) * SIGNATURE_CONTRAST);
  }
}

export async function enhanceSignatureImage(source: string): Promise<Blob> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Could not load signature image (${response.status} ${response.statusText})`);
  }

  const image = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Could not create a canvas context to enhance the signature image");
    }

    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, image.width, image.height);
    darkenSignaturePixels(imageData.data);
    context.putImageData(imageData, 0, 0);

    const enhancedImage = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not encode the enhanced signature image"));
        }
      }, "image/png");
    });

    return enhancedImage;
  } finally {
    image.close();
  }
}
