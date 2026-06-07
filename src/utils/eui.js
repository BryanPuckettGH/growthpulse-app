// Pull the LoRaWAN Gateway EUI out of whatever a gateway QR code (or pasted
// text) contains. Real-world gateway QRs are not just the EUI: the ThinkNode
// G1, for example, encodes four newline-separated values:
//
//   e4:38:19:2a:58:80      <- Wi-Fi MAC   (6 bytes / 12 hex)
//   e4:38:19:2a:58:81      <- ETH MAC     (6 bytes / 12 hex)
//   e4:38:19:ff:fe:2a:58:80 <- Gateway EUI (8 bytes / 16 hex)  <-- the one we want
//   G0US1255000300054      <- serial number
//
// The EUI is the 8-byte value; the MACs are only 6 bytes, so length tells them
// apart. We never stitch bytes across a line, so a pair of MACs can't be
// mistaken for an EUI.
export function euiFromText(text) {
  if (text == null) return null;
  // QR readers sometimes hand back URL-encoded newlines/colons.
  const decoded = String(text)
    .replace(/%0A/gi, '\n')
    .replace(/%0D/gi, '\r')
    .replace(/%3A/gi, ':');

  const isEui = (s) => /^[0-9a-fA-F]{2}([:\-]?[0-9a-fA-F]{2}){7}$/.test(s);
  const pretty = (s) => s.replace(/[^0-9a-fA-F]/g, '').toUpperCase().match(/.{2}/g).join(':');

  // Prefer a line that is exactly an 8-byte EUI.
  for (const raw of decoded.split(/[\r\n]+/)) {
    const line = raw.trim();
    if (isEui(line)) return pretty(line);
  }
  // Fallback for JSON/URL payloads: an 8-byte run with :/- separators only
  // (never whitespace, so it can't span two lines), bounded so we don't grab a
  // slice of a longer hex blob.
  const m = decoded.match(/(?<![0-9a-fA-F:\-])([0-9a-fA-F]{2}(?:[:\-]?[0-9a-fA-F]{2}){7})(?![0-9a-fA-F:\-])/);
  return m ? pretty(m[1]) : null;
}
