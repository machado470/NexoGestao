/** Optimized private JPEG, with original metadata removed by canvas. */
export async function prepareEvidencePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma foto JPEG, PNG ou WebP.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("A foto original deve ter até 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > 50000000
    )
      throw new Error("Escolha uma foto de até 50 megapixels.");
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Não foi possível preparar a foto neste navegador.");
    for (const side of [1280, 1024, 768, 512]) {
      const ratio = Math.min(
        1,
        side / Math.max(image.naturalWidth, image.naturalHeight)
      );
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.45]) {
        const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
        if (Math.floor((base64.length * 3) / 4) <= 65536) return base64;
      }
    }
    throw new Error(
      "Não foi possível otimizar esta foto. Escolha outra imagem."
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
