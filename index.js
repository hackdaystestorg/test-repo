const express = require('express')
const { WebClient } = require('@slack/web-api')

const port = process.env.PORT
const slackToken = process.env.SLACK_TOKEN
const users = JSON.parse(Buffer.from(process.env.USERS, 'base64').toString('ascii'))

const app = express()
const slackClient = new WebClient(slackToken)

app.use(express.json())

app.post('/messages', async (req, res, next) => {
  try {
    await slackClient.chat.postMessage({
      text: 'Hi there!',
      channel: 'channel',
      as_user: true
    });
    res.status(204).send()
  } catch(error) {
    return next(error)
  }
})

app.post('/events', (req, res) => {
  const event = req.body
  switch (event.action) {
    case 'review_requested': {
      const { url, number, title } = event.pull_request
      const userName = event.pull_request.user.login
      const reviewerNames = event.requested_reviewers
      console.log(url, number, title, userName, reviewerNames)
    }
    default: {
      console.log(`EVENT NOT HANDLED: ${event.action}`)
    }
  }
  res.status(204).send()
})

// Error handler should be placed after all other middlewares
app.use((err, req, res, next) => {
  error = { code: err.code, message: err.message }
  console.error(`ERROR: ${JSON.stringify(error)}`)
  res.status(500).send(error)
})

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`)
})
