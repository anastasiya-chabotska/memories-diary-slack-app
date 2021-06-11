require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const serverlessExpress = require("@vendia/serverless-express");
var Sequelize = require("sequelize");
var db = require("./db");
var { Memory } = require("./db");

const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});
// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver,
});

app.message("goodbye", async ({ message, say, client }) => {
  await say(`See you later, <@${message.user}> :wave:`);
});
// Listens to incoming messages that contain "hello"
app.message("hello", async ({ message, say }) => {
  // say() sends a message to the channel where the event was triggered
  await say({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Hey there <@${message.user}>!`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Click Me",
          },
          action_id: "button_click",
        },
      },
    ],
    text: `Hey there <@${message.user}>!`,
  });
});

app.action("button_click", async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  console.log(body);
  await say(`<@${body.user.id}> clicked the button`);
});

app.command("/memory", async ({ ack, body, client }) => {
  // Acknowledge the command request
  await ack();
  try {
    // Call views.open with the built-in client
    const result = await client.views.open({
      // Pass a valid trigger_id within 3 seconds of receiving it
      trigger_id: body.trigger_id,
      // View payload
      view: {
        type: "modal",
        // View identifier
        callback_id: "view_1",
        title: {
          type: "plain_text",
          text: "Memories :sparkles:",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Add new entry to your memories diary :ledger:",
            },
          },
          {
            type: "divider",
          },
          {
            type: "input",
            block_id: "title",
            element: {
              type: "plain_text_input",
              placeholder: {
                type: "plain_text",
                text: "Add a title to your memory",
                emoji: true,
              },
              action_id: "title",
            },
            label: {
              type: "plain_text",
              text: "Memory Title",
              emoji: true,
            },
          },
          {
            type: "input",
            block_id: "people",
            element: {
              type: "multi_users_select",
              placeholder: {
                type: "plain_text",
                text: "Select users",
                emoji: true,
              },
              action_id: "people",
            },
            label: {
              type: "plain_text",
              text: "Who were with you?",
              emoji: true,
            },
          },
          {
            type: "input",
            block_id: "description",
            element: {
              type: "plain_text_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Describe what you were doing",
                emoji: true,
              },
              action_id: "description",
            },
            label: {
              type: "plain_text",
              text: "Description",
              emoji: true,
            },
          },

          {
            type: "input",
            block_id: "mood",
            element: {
              type: "radio_buttons",
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: ":heart_eyes:",
                    emoji: true,
                  },
                  value: "value-0",
                },
                {
                  text: {
                    type: "plain_text",
                    text: ":joy:",
                    emoji: true,
                  },
                  value: "value-1",
                },
                {
                  text: {
                    type: "plain_text",
                    text: ":smiley:",
                    emoji: true,
                  },
                  value: "value-2",
                },
                {
                  text: {
                    type: "plain_text",
                    text: ":blush:",
                    emoji: true,
                  },
                  value: "value-3",
                },
                {
                  text: {
                    type: "plain_text",
                    text: ":pensive:",
                    emoji: true,
                  },
                  value: "value-4",
                },

                {
                  text: {
                    type: "plain_text",
                    text: ":sleeping:",
                    emoji: true,
                  },
                  value: "value-5",
                },
              ],
              action_id: "mood",
            },
            label: {
              type: "plain_text",
              text: "How were you feeling?",
              emoji: true,
            },
          },
          {
            type: "input",
            block_id: "date",
            element: {
              type: "datepicker",
              initial_date: "1990-04-28",
              placeholder: {
                type: "plain_text",
                text: "Select a date",
                emoji: true,
              },
              action_id: "date",
            },
            label: {
              type: "plain_text",
              text: "Select a date for your memory",
              emoji: true,
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

// Handle a view_submission event
app.view("view_1", async ({ ack, body, view, client }) => {
  // Acknowledge the view_submission event
  await ack();

  let title = view.state.values.title.title.value;
  let description = view.state.values.description.description.value;
  let people = view.state.values.people.people.selected_users;
  let mood = view.state.values.mood.mood.selected_option.text.text;
  let date = view.state.values.date.date.selected_date;

  //save the data to a db
  saveMemoryToDb({ title, description, users: people, mood_emoji: mood, date });

  let users = "";
  for (let i = 0; i < people.length; i++) {
    users += "<@" + people[i] + "> ";
  }
  console.log(
    "Title: " +
      title +
      "Description: " +
      description +
      "people" +
      people +
      "mood" +
      mood
  );

  try {
    const response = await client.chat.postMessage({
      channel: "memories",
      text: "new memory",

      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${title}* ${mood}\non *${date}* \nwith ${users}`,
          },
        },

        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: `${description}`,
            emoji: true,
          },
        },
      ],
    });
    console.log(response);
  } catch (error) {
    console.log(error);
  }
});

async function saveMemoryToDb(obj) {
  await Memory.create(obj);
}

// //test
// let title = "Hello";
// let description = "fndjkfbvrhkbvbkefr";
// let people = ["anastasiya", "jamila"];
// let mood = "sparkles";
// let memory_date = "2021-04-01";

// saveMemoryToDb({
//   title,
//   description,
//   users: people,
//   mood_emoji: mood,
//   date: memory_date,
// });

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();

module.exports.handler = serverlessExpress({
  app: expressReceiver.app,
});
