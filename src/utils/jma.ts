import {
  type ListEvent,
  type Earthquake,
  type Translation,
  type DetailedEarthquake,
  type ProcessedEarthquake,
  type ProcessedJustEarthquake,
  EarthquakeSchema,
  DetailedEarthquakeSchema,
} from '../types'

const _processDetailedData = (data: DetailedEarthquake): ProcessedEarthquake | null => {
  if (!data.Body.Intensity.Observation.Pref.length) {
    return null
  }

  return {
    time: data.Body.Earthquake.OriginTime,
    magnitude: data.Body.Earthquake.Magnitude,
    maxInt: data.Body.Intensity.Observation.MaxInt,
    location: {
      code: data.Body.Earthquake.Hypocenter.Area.Code,
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
    comments: {
      hasTsunamiWarning: data.Body.Comments.ForecastComment.Text !== 'この地震による津波の心配はありません。',
    },
  }
}

const _processJustEarthquakeData = (data: Earthquake): ProcessedJustEarthquake => {
  return {
    time: data.Body.Earthquake.OriginTime,
    magnitude: data.Body.Earthquake.Magnitude,
    location: {
      code: data.Body.Earthquake.Hypocenter.Area.Code,
      coordinate: data.Body.Earthquake.Hypocenter.Area.Coordinate,
    },
    comments: {
      hasTsunamiWarning: data.Body.Comments.ForecastComment.Text === '1',
    },
  }
}

export const fetchJMAData = async (): Promise<{
  detailed: ProcessedEarthquake[]
  basic: ProcessedJustEarthquake[]
}> => {
  const listResponse = await fetch('https://www.jma.go.jp/bosai/quake/data/list.json')
  if (!listResponse.ok) {
    throw new Error('Failed to fetch list.json')
  }
  const listData = (await listResponse.json()) as ListEvent[]

  const events = listData.slice(0, 20).reduce<{
    detailedInfo: ListEvent[]
    basicInfo: ListEvent[]
  }>(
    (acc, event) => {
      const url = `https://www.jma.go.jp/bosai/quake/data/${event.json}`
      if (url.includes('VXSE5k')) {
        acc.detailedInfo.push(event)
      } else if (url.includes('VXSE52')) {
        acc.basicInfo.push(event)
      }
      return acc
    },
    { detailedInfo: [], basicInfo: [] }
  )

  const [detailedResults, basicResults] = await Promise.all([
    Promise.all(
      events.detailedInfo.map(async event => {
        try {
          const url = `https://www.jma.go.jp/bosai/quake/data/${event.json}`
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`)
          }

          const detailedData = await response.json()
          const parsedDetailedData =
            typeof detailedData === 'string' ? JSON.parse(detailedData) : detailedData

          if (!parsedDetailedData.Body?.Earthquake) {
            return null
          }

          const parsedData = DetailedEarthquakeSchema.parse(parsedDetailedData)
          return _processDetailedData(parsedData)
        } catch (error) {
          console.error('Error fetching detailed data:', error)
          return null
        }
      })
    ),
    Promise.all(
      events.basicInfo.map(async event => {
        try {
          const url = `https://www.jma.go.jp/bosai/quake/data/${event.json}`
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`)
          }

          const data = await response.json()
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data

          if (!parsedData.Body?.Earthquake) {
            return null
          }

          const earthquake = EarthquakeSchema.parse(parsedData)
          return _processJustEarthquakeData(earthquake)
        } catch (error) {
          console.error('Error fetching basic data:', error)
          return null
        }
      })
    ),
  ])

  return {
    detailed: detailedResults.filter((result): result is ProcessedEarthquake => result !== null),
    basic: basicResults.filter((result): result is ProcessedJustEarthquake => result !== null),
  }
}

export const translateEarthquakeData = (
  data: ProcessedEarthquake[] | ProcessedJustEarthquake[],
  lang: string,
  translations: { epi: Translation; pref: Translation; city: Translation }
) => {
  return data.map(quake => {
    if ('regions' in quake) {
      return {
        ...quake,
        location: {
          ...quake.location,
          name: translations.epi[quake.location.code]?.[lang] || quake.location.code,
        },
        regions: quake.regions.map(region => ({
          prefecture: translations.pref[region.pref_code]?.[lang] || region.pref_code,
          areas: region.areas.map(area => ({
            name: translations.epi[area.area_code]?.[lang] || area.area_code,
            cities: area.cities.map(city => ({
              name: translations.city[city.city_code]?.[lang] || city.city_code,
            })),
          })),
        })),
      }
    }
    return {
      ...quake,
      location: {
        ...quake.location,
        name: translations.epi[quake.location.code]?.[lang] || quake.location.code,
      },
    }
  })
}

export const getTranslations = async (kv: KVNamespace) => {
  const [epi, pref, city] = await Promise.all([
    kv.get('dictionary:epi', 'json') as Promise<Translation>,
    kv.get('dictionary:pref', 'json') as Promise<Translation>,
    kv.get('dictionary:city', 'json') as Promise<Translation>,
  ])
  return { epi, pref, city }
}
