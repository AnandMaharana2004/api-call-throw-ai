import { configDotenv } from 'dotenv';
configDotenv()
import OpenAI from 'openai';
import readlineSync from "readline-sync";

const openApiKey = process.env.OPENAI_API_KEY
if (!openApiKey) throw new Error("Please provide the open api key")

const client = new OpenAI({
    apiKey: openApiKey
});

const SYSTEM_INSTRUCTION = `
You are an AI Assistant with START, PLAN, ACTION, observations, and output state.
Wait for the user prompt and first PLAN using available tools.
After planning, take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, return the AI Response based on START prompt and observations.

Strictly follow the JSON Output format as in example:

Available Tools:
- function getWeatherDetails(city : string): string
  getWeatherDetails is a function that accepts city name as string and returns the weather details as string

Example:
START
{ "type" : "user", "user" : "what is the weather today in Hyderabad" }
{ "type" : "plan", "plan" : "I will call getWeatherDetails" }
{ "type" : "action", "function" : "getWeatherDetails", "input" : "Hyderabad"}
{ "type" : "observation", "observation" : "10°C" }
{ "type" : "output", "output" : "The weather today in Hyderabad is 10°C" }
`;

const Tools = {
    getWeatherDetails: getWeatherDetails
};

function getWeatherDetails(city) {
    console.log("getWeatherDetails function is called with city:", city);
    return "15°C"; // Dummy return for now
}

const messages = [{
    role: "system", content: SYSTEM_INSTRUCTION
}];

async function main() {
    while (true) {
        const query = readlineSync.question("->> "); // user query
        if (query.toLowerCase() === "exit") break;

        const askQuery = {
            type: "user",
            user: query
        };

        // Push user input as JSON string
        messages.push({ role: "user", content: JSON.stringify(askQuery) });

        while (true) {
            const chat = await client.chat.completions.create({
                model: "gpt-4.1-nano", // Changed to a valid model
                messages: messages
            });

            const result = chat.choices[0].message.content;
            messages.push({ role: "assistant", content: result });

            let call;
            try {
                call = JSON.parse(result);
            } catch (err) {
                console.error("Failed to parse AI response as JSON:", err);
                break;
            }

            // Handle all response types
            switch (call.type) {
                case "output":
                    console.log(call.output);
                    break; // break inner loop, go back to user input
                case "action":
                    const fn = Tools[call.function];
                    if (fn) {
                        const fnOutput = fn(call.input);
                        const observation = { type: "observation", observation: fnOutput };
                        messages.push({ role: "assistant", content: JSON.stringify(observation) });
                        continue; // continue the loop to get next response
                    } else {
                        console.error("Unknown function requested:", call.function);
                        break;
                    }
                case "plan":
                    console.log("Plan:", call.plan);
                    continue; // continue the loop to get next response
                default:
                    console.error("Unknown type in AI response:", call.type);
                    break;
            }
            break; // Break the inner loop if we reach here
        }
    }
}

main();