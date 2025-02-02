import { type Product, RakutenResponseSchema, YahooResponseSchema } from '../types'

export const fetchRakutenItem = async (janCode: string, appId: string): Promise<Product> => {
  const url = new URL('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601')
  url.searchParams.set('format', 'json')
  url.searchParams.set('keyword', janCode)
  url.searchParams.set('applicationId', appId)
  url.searchParams.set('hits', '1')

  const response = await fetch(url)
  const rawData = await response.json()
  const data = RakutenResponseSchema.parse(rawData)

  const item = data.Items[0].Item
  return {
    name: item.itemName,
    description: `${item.catchcopy || ''} ${item.itemCaption}`.trim(),
  }
}

export const fetchYahooItem = async (janCode: string, appId: string): Promise<Product> => {
  const url = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch')
  url.searchParams.set('appid', appId)
  url.searchParams.set('jan_code', janCode)
  url.searchParams.set('results', '1')

  const response = await fetch(url)
  const rawData = await response.json()
  const data = YahooResponseSchema.parse(rawData)

  const item = data.hits[0]
  return {
    name: item.name,
    description: `${item.description} ${item.headLine || ''}`.trim(),
  }
}
