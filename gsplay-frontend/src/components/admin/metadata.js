export const emptyMetadata = {
  title: '',
  summary: '',
  artwork: '',
  genres: '',
  platforms: '',
  releaseDate: ''
}

export function metadataPayload(value) {
  const splitList = (items) =>
    items
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  return {
    ...value,
    genres: splitList(value.genres),
    platforms: splitList(value.platforms),
    releaseDate: value.releaseDate || null
  }
}
