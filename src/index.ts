import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(
  '*',
  cors({
    origin: 'https://shop.mohil.dev',
    allowMethods: ['GET', 'POST'],
    exposeHeaders: ['Content-Type'],
  })
)

interface CloudflareBindings {
  RAKUTEN_APP_ID: string
  YAHOO_APP_ID: string
  GEMINI_API_KEY: string
  PRODUCT_CACHE: KVNamespace
}

const LanguageCode = z.enum([
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

const LANGUAGE_NAMES = {
  ar: 'Arabic',
  bn: 'Bengali',
  bg: 'Bulgarian',
  zh: 'Chinese',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  iw: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ko: 'Korean',
  lv: 'Latvian',
  lt: 'Lithuanian',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sr: 'Serbian',
  sk: 'Slovak',
  sl: 'Slovenian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
} as const

const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'] as const

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number]

const MAX_FILE_SIZE = 20 * 1024 * 1024

const JanCodeSchema = z.string().regex(/^\d{13}$/)

const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
})

type Product = z.infer<typeof ProductSchema>

const RakutenResponseSchema = z.object({
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

const YahooResponseSchema = z.object({
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

const geminiSchema = {
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

const IngredientsResponseSchema = z.object({
  ingredients: z.array(z.string()),
  vegetarian: z.boolean(),
  containsMeat: z.boolean(),
  containsFish: z.boolean(),
  isVegan: z.boolean(),
  note: z.string().optional().default(''),
})

type IngredientsResponse = z.infer<typeof IngredientsResponseSchema>

const geminiIngredientsSchema = {
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

const fetchRakutenItem = async (janCode: string, appId: string): Promise<Product> => {
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

const fetchYahooItem = async (janCode: string, appId: string): Promise<Product> => {
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

const getGeminiResponse = async (
  prompt: string,
  apiKey: string,
  targetLang: keyof typeof LANGUAGE_NAMES
): Promise<Product> => {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: geminiSchema,
    },
  })

  const result = await model.generateContent(`
    ${prompt}
    Translate the content to ${LANGUAGE_NAMES[targetLang]} language.
  `)

  return ProductSchema.parse(JSON.parse(result.response.text()))
}

const _arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  return btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))
}

app.get(
  '/barcode/:janCode/:lang',
  zValidator(
    'param',
    z.object({
      janCode: JanCodeSchema,
      lang: LanguageCode,
    })
  ),
  async c => {
    const { janCode, lang } = c.req.valid('param')
    const cacheKey = `${janCode}:${lang}`

    const cached = await c.env.PRODUCT_CACHE.get(cacheKey, 'json')
    if (cached) {
      return c.json(cached)
    }

    try {
      const [rakutenData, yahooData] = await Promise.allSettled([
        fetchRakutenItem(janCode, c.env.RAKUTEN_APP_ID),
        fetchYahooItem(janCode, c.env.YAHOO_APP_ID),
      ])

      const sources = [
        rakutenData.status === 'fulfilled' && rakutenData.value,
        yahooData.status === 'fulfilled' && yahooData.value,
      ].filter(Boolean) as Product[]

      if (!sources.length) {
        return c.json({ error: 'No product information found' }, 404)
      }

      const sourceIntro =
        sources.length > 1
          ? 'Analyze and combine these product descriptions'
          : 'Analyze this product description'

      const prompt = `
        ${sourceIntro} to create a concise summary. Focus on essential information:
        - Product name and type (Do not include quantity or packaging details in name)
        - Key features
        - Main ingredients/materials
        - Primary purpose and usage

        Ensure the description is:
        - Clear and concise
        - Easy to understand
        - Focused on practical information
        - Well-structured

        Remove any:
        - Packaging details
        - Dates and expiration info
        - Shipping/delivery info
        - Storage instructions
        - Pricing
        - Promotional text
        - Shop-specific details
        - Event/occasion suggestions

        Source${sources.length > 1 ? 's' : ''}:
        ${sources
          .map(
            (s, i) => `
          ${sources.length > 1 ? `Source ${i + 1}:` : ''}
          - Name: ${s.name}
          - Description: ${s.description}
        `
          )
          .join('\n')}
      `

      const result = await getGeminiResponse(prompt, c.env.GEMINI_API_KEY, lang)

      await c.env.PRODUCT_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 31536000 })
      return c.json(result)
    } catch (error) {
      console.error(error)
      return c.json({ error: 'Failed to process request' }, 500)
    }
  }
)

app.post(
  '/ingredients',
  zValidator(
    'form',
    z.object({
      file: z.instanceof(File),
      lang: LanguageCode,
    })
  ),
  async c => {
    const { file, lang } = c.req.valid('form')

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType)) {
      return c.json(
        {
          error: `Unsupported file type. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
        },
        400
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        400
      )
    }

    try {
      const arrayBuffer = await file.arrayBuffer()

      const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiIngredientsSchema,
        },
      })

      const imagePart = {
        inlineData: {
          data: _arrayBufferToBase64(arrayBuffer),
          mimeType: file.type,
        },
      }

      const prompt = `
        Analyze this product image and extract all ingredients. For each ingredient:
        1. Identify its common name in ${LANGUAGE_NAMES[lang]}
        2. Determine if any ingredients are non-vegetarian, contain meat/fish, or make the product non-vegan
        3. Add a note about any uncertain identifications, ambiguous ingredient names, or potential cross-contamination warnings
        4. Dairy is considered vegetarian

        Important:
        - Be thorough in ingredient identification
        - Note any allergens clearly
        - Mention if any text is unclear or partially visible
        - Don't be overly cautious about origin of ingredients, like if amino acids are present, don't wonder if they're from animal sources or not unless mentioned explicitly
        - If ingredients list is not visible or readable, state this clearly in the note
        - output ingredients and note in ${LANGUAGE_NAMES[lang]} language

        Respond with valid JSON format matching the specified schema.
      `

      const result = await model.generateContent([prompt, imagePart])
      const textResult = result.response.text()

      let parsedResult: IngredientsResponse

      try {
        parsedResult = IngredientsResponseSchema.parse(JSON.parse(textResult))
      } catch (parseError) {
        console.error('Response parsing error:', parseError)
        return c.json(
          {
            error: 'Failed to parse ingredients information',
            details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          },
          422
        )
      }

      return c.json(parsedResult)
    } catch (error) {
      console.error('Ingredients analysis error:', error)

      if (error instanceof Error) {
        if (error.message.includes('RESOURCE_EXHAUSTED')) {
          return c.json(
            {
              error: 'API rate limit exceeded. Please try again later.',
            },
            429
          )
        }

        if (error.message.includes('INVALID_ARGUMENT')) {
          return c.json(
            {
              error:
                'Invalid image format or content. Please ensure the image is clear and contains ingredient information.',
            },
            400
          )
        }

        if (error.message.includes('FAILED_PRECONDITION')) {
          return c.json(
            {
              error: 'Service currently unavailable. Please try again later.',
            },
            503
          )
        }
      }

      return c.json(
        {
          error:
            'Failed to analyze ingredients. Please ensure the image contains legible ingredient information.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      )
    }
  }
)

app.get('/', c => c.text('Hello World!'))

export default app
