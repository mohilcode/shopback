import { GoogleGenerativeAI } from '@google/generative-ai'
import { LANGUAGE_NAMES } from '../constants'
import { ProductSchema, type Product, geminiSchema } from '../types'

export const getGeminiResponse = async (
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
