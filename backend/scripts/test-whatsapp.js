// Script de prueba puntual: confirma que WHATSAPP_ACCESS_TOKEN y
// WHATSAPP_PHONE_NUMBER_ID funcionan de punta a punta usando la plantilla
// "hello_world" (preaprobada por Meta), sin depender de que "alerta_vehiamb"
// ya este aprobada. Uso: node scripts/test-whatsapp.js <celular-destino>
require("dotenv").config();
const env = require("../src/config/env");

async function main() {
  const celular = process.argv[2];
  if (!celular) {
    console.error("Uso: node scripts/test-whatsapp.js <celular-destino-con-codigo-pais>");
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.whatsappToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: celular,
      type: "template",
      template: {
        name: "hello_world",
        language: { code: "en_US" }
      }
    })
  });

  const body = await response.text();
  console.log(`HTTP ${response.status}`);
  console.log(body);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
