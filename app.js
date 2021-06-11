require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const serverlessExpress = require("@vendia/serverless-express");
var Sequelize = require("sequelize");
var db = require("./db");
var { Memory } = require("./db");
const { Op } = require("sequelize");

let numOfResultsToShow;

const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});
// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver,
});

//construct blocks to be viewed in app home here
async function createBlocks(user, number) {
  let memories = await findMemories(user);
  // console.log(memories);
  let memoriesCount = await countMemories(user);
  // console.log("Total Memories: " + memoriesCount);

  let blocks = new Array();
  blocks.push(
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Welcome home <@${user}>, :sparkles:* `,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "To use the Memories Diary App just type */memory* in any channel and fill out the form. All memories can be found in channel #memories \n\nBelow you will find most recents memories in which you were tagged",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `We found *${memoriesCount} Memories* with you`,
      },

      accessory: {
        type: "overflow",
        options: [
          {
            text: {
              type: "plain_text",
              emoji: true,
              text: "Newest First",
            },
            value: "ASC",
          },
          {
            text: {
              type: "plain_text",
              emoji: true,
              text: "Oldest",
            },
            value: "DESC",
          },
        ],
        action_id: "filter",
      },
    },

    {
      type: "divider",
    }
  );

  console.log(number);
  let loop;
  if (number < memoriesCount) {
    loop = number;
  } else {
    loop = memoriesCount;
  }

  for (let i = 0; i < loop; i++) {
    let users = "";
    for (let j = 0; j < memories[i].users.length; j++) {
      users += `<@${memories[i].users[j]}> `;
    }

    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<fakeLink.toHotelPage.com|${memories[i].title}>*\n${memories[i].mood_emoji}\non ${memories[i].date}\nwith users \n${users}\n${memories[i].description}`,
        },
        accessory: {
          type: "image",
          image_url:
            "https://api.slack.com/img/blocks/bkb_template_images/tripAgent_1.png",
          alt_text: "Windsor Court Hotel thumbnail",
        },
      },
      {
        type: "divider",
      }
    );
  }
  if (number < memoriesCount) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            emoji: true,
            text: "View More",
          },
          value: "click_me_123",
          action_id: "showMore",
        },
      ],
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "plain_text",
        emoji: true,
        text: "No more memories found :sweat:",
      },
    });
  }

  return { blocks, memoriesCount };
}

app.action("filter", async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  console.log("FILTER");
  console.log(body.actions[0].selected_option);
});
// Listen for users opening your App Home
app.event("app_home_opened", async ({ event, client }) => {
  numOfResultsToShow = 3;
  let result = await await createBlocks(event.user, numOfResultsToShow);
  let myBlocks = result.blocks;

  console.log("NUMBER OF RESULTS TO SHOW", numOfResultsToShow);
  let memoriesCount = result.memoriesCount;

  try {
    // Call views.publish with the built-in client
    const result = await client.views.publish({
      // Use the user ID associated with the event
      user_id: event.user,
      view: {
        // Home tabs must be enabled in your app configuration page under "App Home"
        type: "home",
        callback_id: "homeView",
        blocks: myBlocks,
      },
    });

    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

// Listen for a button invocation with action_id `button_abc` (assume it's inside of a modal)
app.action("showMore", async ({ ack, body, client }) => {
  console.log("Body");
  console.log(body);
  console.log(client.views);
  let myBlocks = await (
    await createBlocks(body.user.id, numOfResultsToShow + 3)
  ).blocks;
  numOfResultsToShow += 3;
  // Acknowledge the button request
  await ack();

  try {
    // Call views.update with the built-in client
    const result = await client.views.update({
      // Pass the view_id
      view_id: body.view.id,
      // Pass the current hash to avoid race conditions
      // hash: body.view.hash,
      // View payload with updated blocks
      user_id: body.user.id,
      view: {
        type: "home",
        // View identifier
        callback_id: "showingMore",
        title: {
          type: "plain_text",
          text: "Updated modal",
        },
        blocks: myBlocks,
      },
    });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

async function findMemories(userId) {
  let memories = await Memory.findAll({
    where: {
      users: { [Op.contains]: [userId] },
    },
    order: [["date", "DESC"]],
    //this gets rid of previousdata values that appeared after ordering
    // raw: true,
  });
  return memories;
}

async function countMemories(userId) {
  let memoriesCount = await Memory.count({
    where: { users: { [Op.contains]: [userId] } },
  });
  return memoriesCount;
}

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
