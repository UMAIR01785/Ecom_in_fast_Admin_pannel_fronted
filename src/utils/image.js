export async function convertToWebp(
  file,
  { maxSize = 1280, quality = 0.85, maxMB = 5 } = {}
) {
  if (!file) throw new Error("No image selected.")
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.")

  if (file.type === "image/webp") return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to convert image to WebP."))),
      "image/webp",
      quality
    )
  })

  if (blob.type !== "image/webp") return file

  if (blob.size > maxMB * 1024 * 1024) {
    throw new Error(`Image is too large. Please use an image under ${maxMB} MB.`)
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image"
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  })
}
