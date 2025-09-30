const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function encryptDataWithKey(secretData: string, aesKey: CryptoKey) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encryptedContent = await crypto.subtle.encrypt(
      {
        iv: iv,
        name: 'AES-GCM',
      },
      aesKey,
      encoder.encode(secretData),
    )

    const encryptedContentArr = new Uint8Array(encryptedContent)
    const buff = new Uint8Array(iv.byteLength + encryptedContentArr.byteLength)
    buff.set(iv, 0)
    buff.set(encryptedContentArr, iv.byteLength)
    const base64Buff = buf_to_base64(buff)
    return base64Buff
  } catch (e) {
    console.error('Error encrypting data', { cause: e })
    return ''
  }
}

const buf_to_base64 = (buf: Uint8Array) =>
  btoa(String.fromCharCode.apply(null, buf as unknown as number[]))
const base64_to_buf = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(null as unknown as number))

async function decryptDataWithKey(encryptedData: string, aesKey: CryptoKey) {
  try {
    const encryptedDataBuff = base64_to_buf(encryptedData)
    const iv = encryptedDataBuff.slice(0, 12)
    const data = encryptedDataBuff.slice(12)
    const decryptedContent = await crypto.subtle.decrypt(
      {
        iv: iv,
        name: 'AES-GCM',
      },
      aesKey,
      data,
    )
    return decoder.decode(decryptedContent)
  } catch (e) {
    console.error('Error decrypting data', { cause: e })
    return ''
  }
}

export { encryptDataWithKey, decryptDataWithKey }
