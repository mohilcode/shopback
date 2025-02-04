import { z } from 'zod'
import { SchemaType } from '@google/generative-ai'

export const LanguageCode = z.enum([
  'ar',
  'bn',
  'bg',
  'zh',
  'hr',
  'cs',
  'da',
  'nl',
  'en',
  'et',
  'fi',
  'fr',
  'de',
  'el',
  'iw',
  'hi',
  'hu',
  'id',
  'it',
  'ko',
  'lv',
  'lt',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sr',
  'sk',
  'sl',
  'es',
  'sw',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
])
export type LanguageCode = z.infer<typeof LanguageCode>

export const JanCodeSchema = z.string().regex(/^\d{13}$/)

export const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
})
export type Product = z.infer<typeof ProductSchema>

export const RakutenResponseSchema = z.object({
  Items: z
    .array(
      z.object({
        Item: z.object({
          itemName: z.string(),
          catchcopy: z.string().optional(),
          itemCaption: z.string(),
        }),
      })
    )
    .min(1),
})

export const YahooResponseSchema = z.object({
  hits: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        headLine: z.string().optional(),
      })
    )
    .min(1),
})

export const geminiSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description: 'Product name in specified language',
    },
    description: {
      type: SchemaType.STRING,
      description: 'Comprehensive product description in specified language',
    },
  },
  required: ['name', 'description'],
}

export const IngredientsResponseSchema = z.object({
  ingredients: z.array(z.string()),
  vegetarian: z.boolean(),
  containsMeat: z.boolean(),
  containsFish: z.boolean(),
  isVegan: z.boolean(),
  note: z.string().optional().default(''),
})
export type IngredientsResponse = z.infer<typeof IngredientsResponseSchema>

export const geminiIngredientsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    ingredients: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    vegetarian: { type: SchemaType.BOOLEAN },
    containsMeat: { type: SchemaType.BOOLEAN },
    containsFish: { type: SchemaType.BOOLEAN },
    isVegan: { type: SchemaType.BOOLEAN },
    note: { type: SchemaType.STRING },
  },
  required: ['ingredients', 'vegetarian', 'containsMeat', 'containsFish', 'isVegan', 'note'],
}

export const EarthquakeSchema = z.object({
  Body: z.object({
    Earthquake: z.object({
      OriginTime: z.string(),
      Magnitude: z.string(),
      Hypocenter: z.object({
        Area: z.object({
          Code: z.string(),
          Coordinate: z.string(),
        }),
      }),
    }),
    Comments: z.object({
      ForecastComment: z.object({
        Text: z.string(),
      }),
    }),
  }),
})
export type Earthquake = z.infer<typeof EarthquakeSchema>

export const DetailedEarthquakeSchema = z.object({
  Body: z.object({
    Earthquake: z.object({
      OriginTime: z.string(),
      Magnitude: z.string(),
      Hypocenter: z.object({
        Area: z.object({
          Code: z.string(),
          Coordinate: z.string(),
        }),
      }),
    }),
    Intensity: z.object({
      Observation: z.object({
        MaxInt: z.string(),
        Pref: z.array(
          z.object({
            Code: z.string(),
            Area: z.array(
              z.object({
                Code: z.string(),
                City: z.array(
                  z.object({
                    Code: z.string(),
                    MaxInt: z.string(),
                  })
                ),
              })
            ),
          })
        ),
      }),
    }),
    Comments: z.object({
      ForecastComment: z.object({
        Text: z.string(),
      }),
    }),
  }),
})
export type DetailedEarthquake = z.infer<typeof DetailedEarthquakeSchema>

export const ProcessedEarthquakeSchema = z.object({
  time: z.string(),
  magnitude: z.string(),
  maxInt: z.string(),
  location: z.object({
    code: z.string(),
    coordinate: z.string(),
  }),
  regions: z.array(
    z.object({
      pref_code: z.string(),
      areas: z.array(
        z.object({
          area_code: z.string(),
          cities: z.array(
            z.object({
              city_code: z.string(),
            })
          ),
        })
      ),
    })
  ),
  comments: z.object({
    hasTsunamiWarning: z.boolean(),
  }),
})
export type ProcessedEarthquake = z.infer<typeof ProcessedEarthquakeSchema>

export const ProcessedJustEarthquakeSchema = z.object({
  time: z.string(),
  magnitude: z.string(),
  location: z.object({
    code: z.string(),
    coordinate: z.string(),
  }),
  comments: z.object({
    hasTsunamiWarning: z.boolean(),
  }),
})
export type ProcessedJustEarthquake = z.infer<typeof ProcessedJustEarthquakeSchema>

export const ListEventSchema = z.object({
  json: z.string(),
  int: z.array(z.any()).optional(),
  maxi: z.string().optional(),
})
export type ListEvent = z.infer<typeof ListEventSchema>

export const TranslationSchema = z.record(z.record(z.string()))
export type Translation = z.infer<typeof TranslationSchema>
