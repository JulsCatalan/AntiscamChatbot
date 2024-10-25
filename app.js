const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const JsonFileAdapter = require('@bot-whatsapp/database/json');
const { delay } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const flowCall = addKeyword(['1'])
  .addAnswer('Lamento oír eso, cuéntame en un mensaje sobre la situación: ¿quién te llamó?, ¿de dónde?, ¿qué te dijeron?', { capture: true }, async (ctx, { flowDynamic }) => {
    const prompt = 'A continuación, analiza la situación descrita en este mensaje y proporciona consejos sobre cómo actuar: ' + ctx.body;
    console.log(prompt);
    try {
      const result = await model.generateContent(prompt);
      const ai_response = result.response.text();
      console.log(ai_response);
      await flowDynamic(ai_response);
    } catch (error) {
      if (error instanceof GoogleGenerativeAIResponseError) {
        console.error("Error de bloqueo de respuesta:", error);
        await flowDynamic("La respuesta fue bloqueada. Intenta describir la situación de otra manera.");
      } else {
        console.error("Error generando contenido:", error);
        await flowDynamic("Hubo un error al generar la respuesta, intenta nuevamente más tarde.");
      }
    }
  });

const flowEmail = addKeyword(['2'])
  .addAnswer('Parece que recibiste un correo sospechoso. Por favor, describe el asunto del correo, quién lo envió y el contenido que te genera sospechas.', { capture: true }, async (ctx, { flowDynamic }) => {
    const prompt = 'Analiza la descripción de este correo electrónico y ofrece recomendaciones para que el usuario pueda determinar si es seguro o no: ' + ctx.body;
    console.log(prompt);
    try {
      const result = await model.generateContent(prompt);
      const ai_response = result.response.text();
      console.log(ai_response);
      await flowDynamic(ai_response);
    } catch (error) {
      if (error instanceof GoogleGenerativeAIResponseError) {
        console.error("Error de bloqueo de respuesta:", error);
        await flowDynamic("La respuesta fue bloqueada. Intenta describir la situación de otra manera.");
      } else {
        console.error("Error generando contenido:", error);
        await flowDynamic("Hubo un error al generar la respuesta, intenta nuevamente más tarde.");
      }
    }
  });

const flowLink = addKeyword(['3'])
  .addAnswer('Parece que recibiste un link sospechoso. Por favor, comparte el link y describe el contexto en el que lo recibiste.', { capture: true }, async (ctx, { flowDynamic }) => {
    const prompt = 'Revisa el contexto de este link y proporciona sugerencias para determinar si es seguro abrirlo o no: ' + ctx.body;
    console.log(prompt);
    try {
      const result = await model.generateContent(prompt);
      const ai_response = result.response.text();
      console.log(ai_response);
      await flowDynamic(ai_response);
    } catch (error) {
      if (error instanceof GoogleGenerativeAIResponseError) {
        console.error("Error de bloqueo de respuesta:", error);
        await flowDynamic("La respuesta fue bloqueada. Intenta describir la situación de otra manera.");
      } else {
        console.error("Error generando contenido:", error);
        await flowDynamic("Hubo un error al generar la respuesta, intenta nuevamente más tarde.");
      }
    }
  });

const flowPrincipal = addKeyword(['ayuda'])
  .addAnswer('Hola! Soy tu asistente en ciberseguridad y estoy para ayudarte y resolver tus dudas. Escribe el número de la opción con la que requieres asistencia.', { delay: 1500 })
  .addAnswer([
    '👉 1 - Tuve una llamada sospechosa',
    '👉 2 - Me enviaron un correo sospechoso',
    '👉 3 - Me mandaron un link sospechoso',
  ], null, null, [flowCall, flowEmail, flowLink]);

const main = async () => {
  const adapterDB = new JsonFileAdapter();
  const adapterFlow = createFlow([flowPrincipal]);
  const adapterProvider = createProvider(BaileysProvider);

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
