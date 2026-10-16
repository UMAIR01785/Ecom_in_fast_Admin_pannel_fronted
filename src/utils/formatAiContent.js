function decodeEntities(str) {
  const named = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&nbsp;": " ",
  }
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => named[m] ?? m)
}

export function formatAiContent(raw) {
  if (!raw) return ""
  let text = String(raw)

  text = text.replace(/```[a-z]*\n?/gi, "")
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<\/(p|div|h[1-6]|tr|table|ul|ol|blockquote|pre|section)>/gi, "\n")
  text = text.replace(/<li[^>]*>/gi, "\n- ")
  text = text.replace(/<\/(td|th)>/gi, " | ")
  text = text.replace(/<[^>]+>/g, "")
  text = decodeEntities(text)

  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\|\s*$/gm, "")

  return text.trim()
}
