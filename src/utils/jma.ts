import {
  type DetailedEarthquake,
  type ProcessedEarthquake,
  type ListEvent,
  type Translation,
  DetailedEarthquakeSchema
} from '../types'

const _processDetailedData = (data: DetailedEarthquake): ProcessedEarthquake => {
  return {
    time: data.Body.Earthquake.OriginTime,
    magnitude: data.Body.Earthquake.Magnitude,
    maxInt: data.Body.Intensity.Observation.MaxInt,
    location: {
      coordinate: data.Body.Earthquake.Hypocenter.Area.Coordinate,
    },
    regions: data.Body.Intensity.Observation.Pref.map(pref => ({
      pref_code: pref.Code,
      areas: pref.Area.map(area => ({
        area_code: area.Code,
        cities: area.City.map(city => ({
          city_code: city.Code,
        })),
      })),
    })),
    tsunami: data.Comments.ForecastComment.Code === '0215',
  }
}

export const fetchJMAData = async (): Promise<ProcessedEarthquake[]> => {
  const listResponse = await fetch('https://www.jma.go.jp/bosai/quake/data/list.json')

  if (!listResponse.ok) { throw new Error('Failed to fetch list.json') }
  const listData = (await listResponse.json()) as ListEvent[]

  const top20Events = listData.slice(0, 20)

  const detailedDataPromises = top20Events.map(async (event) => {
    try {
      const url = `https://www.jma.go.jp/bosai/quake/data/${event.json}`
      const response = await fetch(url)
      console.error(response)
      if (!response.ok) { throw new Error(`Failed to fetch ${url}`) }

      const detailedData = (await response.json()) as DetailedEarthquake

      const parsedData = DetailedEarthquakeSchema.parse(detailedData)
      return _processDetailedData(parsedData)
    } catch (error) {
      console.error(`Error fetching detailed data: ${error}`)
      return null
    }
  })

  const results = await Promise.all(detailedDataPromises)
  return results.filter((result): result is ProcessedEarthquake => result !== null)
}

export const translateEarthquakeData = (
  data: ProcessedEarthquake[],
  lang: string,
  translations: { epi: Translation; pref: Translation; city: Translation }
) => {
  return data.map(quake => ({
    ...quake,
    regions: quake.regions.map(region => ({
      prefecture: translations.pref[region.pref_code]?.[lang] || region.pref_code,
      areas: region.areas.map(area => ({
        name: translations.epi[area.area_code]?.[lang] || area.area_code,
        cities: area.cities.map(city => ({
          name: translations.city[city.city_code]?.[lang] || city.city_code
        }))
      }))
    }))
  }))
}

export const getTranslations = async (kv: KVNamespace) => {
  const [epi, pref, city] = await Promise.all([
    kv.get('dictionary:epi', 'json') as Promise<Translation>,
    kv.get('dictionary:pref', 'json') as Promise<Translation>,
    kv.get('dictionary:city', 'json') as Promise<Translation>
  ])
  return { epi, pref, city }
}