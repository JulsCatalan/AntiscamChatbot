const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const JsonFileAdapter = require('@bot-whatsapp/database/json');
const { downloadMediaMessage } = require("@adiwajshing/baileys");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
require("dotenv").config();

ffmpeg.setFfmpegPath(ffmpegPath);

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Función para cargar el archivo de audio y obtener la URI
async function uploadAudioFile(audioPath) {
  try {
    const fileManager = new GoogleAIFileManager(process.env.API_KEY);
    const audioFile = await fileManager.uploadFile(audioPath, {
      mimeType: "audio/mp3",
    });
    return audioFile;
  } catch (error) {
    console.error("Error al subir el archivo de audio:", error);
    throw new Error("Error al subir el archivo de audio.");
  }
}

// Definición de `flowVoiceNote`
const flowVoiceNote = addKeyword(['4']).addAnswer(
  "Envíame tu nota de voz.",
  { capture: true },
  async (ctx, { flowDynamic }) => {
    try {
      const tmpDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

      const filePathOgg = path.join(tmpDir, `voice-note-${Date.now()}.ogg`);
      const filePathMp3 = path.join(tmpDir, `voice-note-${Date.now()}.mp3`);

      // Descargar el archivo de audio en formato OGG
      const buffer = await downloadMediaMessage(ctx, "buffer");
      fs.writeFileSync(filePathOgg, buffer);
      console.log(`Audio OGG guardado en: ${filePathOgg}`);

      // Convertir el archivo OGG a MP3
      await new Promise((resolve, reject) => {
        ffmpeg(filePathOgg)
          .toFormat("mp3")
          .on("end", () => {
            console.log(`Audio convertido a MP3 y guardado en: ${filePathMp3}`);
            resolve();
          })
          .on("error", (error) => {
            console.error("Error al convertir el archivo a MP3:", error);
            reject(error);
          })
          .save(filePathMp3);
      });

      const audioFile = await uploadAudioFile(filePathMp3);

      // Generar contenido usando el archivo de audio y un prompt
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: audioFile.file.mimeType,
            fileUri: audioFile.file.uri,
          },
        },
        { text: "Transcribe the speech" },
      ]);

      const transcribeText = result.response.text();
      console.log("Transcripción:", transcribeText);

      const prompt = `A continuación, analiza la situación descrita en este mensaje y proporciona consejos sobre cómo actuar, recordando que la persona que pregunta es una persona de la tercera edad: ${transcribeText}`;
      const resultText = await model.generateContent(prompt);
      const aiResponse = resultText.response.text();
      console.log("Respuesta AI:", aiResponse);
      await flowDynamic(aiResponse);

      // Limpieza de archivos temporales
      fs.unlinkSync(filePathOgg);
      fs.unlinkSync(filePathMp3);

    } catch (error) {
      console.error("Error al procesar la nota de voz:", error);
      await flowDynamic("Hubo un error al procesar tu nota de voz. Intenta nuevamente.");
    }
  }
);

const flowCall = addKeyword(['1']).addAnswer(
  'Lamento oír eso, cuéntame en un mensaje sobre la situación: ¿quién te llamó?, ¿de dónde?, ¿qué te dijeron?',
  { capture: true },
  async (ctx, { flowDynamic }) => {
    const prompt = `A continuación, analiza la situación descrita en este mensaje y proporciona consejos sobre cómo actuar: ${ctx.body}`;
    console.log(prompt);
    try {
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();
      console.log(aiResponse);
      await flowDynamic(aiResponse);
    } catch (error) {
      console.error("Error generando contenido:", error);
      await flowDynamic("Hubo un error al generar la respuesta, intenta nuevamente más tarde.");
    }
  }
);

const flowEmail = addKeyword(['2']).addAnswer(
  'Describe el asunto del correo, quién lo envió y el contenido que te genera sospechas.',
  { capture: true },
  async (ctx, { flowDynamic }) => {
    const prompt = `Analiza la descripción de este correo electrónico y ofrece recomendaciones para que el usuario pueda determinar si es seguro o no: ${ctx.body}`;
    console.log(prompt);
    try {
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();
      console.log(aiResponse);
      await flowDynamic(aiResponse);
    } catch (error) {
      console.error("Error generando contenido:", error);
      await flowDynamic("Hubo un error al generar la respuesta, intenta nuevamente más tarde.");
    }
  }
);

const flowLink = addKeyword(['3']).addAnswer(
  'Describe el contexto en el que recibiste el enlace sospechoso.',
  { capture: true },
  async (ctx, { flowDynamic }) => {
    const prompt = `Revisa el contexto de este link y proporciona sugerencias para determinar si es seguro abrirlo o no: ${ctx.body}`;
    console.log(prompt);
    try {
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();
      console.log(aiResponse);
      await flowDynamic(aiResponse);
    } catch (error) {
      console.error("Error generando contenido:", error);
      await flowDynamic("Hubo un error al generar la respuesta, intenta nuevamente más tarde.");
    }
  }
);

const flowPrincipal = addKeyword(['activate']).addAnswer(
  'Hola! Soy tu asistente en ciberseguridad y estoy para ayudarte y resolver tus dudas. Escribe el número de la opción con la que requieres asistencia.',
  { delay: 1500 }
).addAnswer([
  '👉 1 - Tuve una llamada sospechosa',
  '👉 2 - Me enviaron un correo sospechoso',
  '👉 3 - Me mandaron un link sospechoso',
  '👉 4 - Enviar una nota de voz explicando la situación y te ayudaré.',
]);

const main = async () => {
  const adapterDB = new JsonFileAdapter();
  const adapterFlow = createFlow([flowPrincipal, flowCall, flowEmail, flowLink, flowVoiceNote]);
  const adapterProvider = createProvider(BaileysProvider);

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
