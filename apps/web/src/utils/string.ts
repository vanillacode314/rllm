function isValidJSON(input: string) {
  try {
    JSON.parse(input)
    return true
  } catch (e) {
    return false
  }
}
const slugify = (input: string) => input.toLowerCase().replace(/\s+/g, '-')

export { isValidJSON, slugify }
