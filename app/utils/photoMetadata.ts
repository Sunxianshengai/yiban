export async function readPhotoMetadata(file: File) {
  const { parse, gps } = await import('exifr')
  const [exif, location] = await Promise.all([
    parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal'], reviveValues: false }).catch(() => undefined),
    gps(file).catch(() => undefined),
  ])
  const raw = exif?.DateTimeOriginal ?? exif?.CreateDate
  let date: Date | undefined
  if (typeof raw === 'string') {
    const timestamp = raw.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}:\d{2}:\d{2})$/)
    if (timestamp) {
      const [, year, month, day, time] = timestamp
      const offset = typeof exif.OffsetTimeOriginal === 'string' && /^[+-]\d{2}:\d{2}$/.test(exif.OffsetTimeOriginal) ? exif.OffsetTimeOriginal : ''
      const parsed = new Date(`${year}-${month}-${day}T${time}${offset}`)
      if (Number.isFinite(+parsed)) date = parsed
    }
  }
  const lat = location?.latitude
  const lng = location?.longitude
  return { date, location: typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined }
}
