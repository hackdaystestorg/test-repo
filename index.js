const express = require('express')
const asyncHandler = require('express-async-handler')
const { Octokit } = require("@octokit/rest")
const { WebClient } = require('@slack/web-api')

const port = process.env.PORT
const githubToken = process.env.GITHUB_TOKEN
const slackToken = process.env.SLACK_TOKEN
const users = JSON.parse(Buffer.from(process.env.USERS, 'base64').toString('ascii'))

const app = express()
const slackClient = new WebClient(slackToken)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.get('/test', asyncHandler(async (req, res) => {
  const octokit = new Octokit({ auth: githubToken })

  const result = await octokit.search.issuesAndPullRequests({ q: 'is:pr is:open org:carnivalmobile review-requested:j-stokes' })
  console.log(result.data)
  console.log(result.data.items[0].user)
  console.log(result.data.items[0].pull_request)
  res.status(204).send()
}))

app.post('/messages', asyncHandler(async (req, res) => {
  await slackClient.chat.postMessage({ text: 'Hi, Eugene!', channel: 'UNWGV07MW' });
  res.status(204).send()
}))

app.post('/events', asyncHandler(async (req, res) => {
  const event = req.body
  switch (event.action) {
    case 'review_requested': {
      const pull = event.pull_request
      const userName = pull.user.login
      const user = users.find(u => u.gname === userName)
      if (!user) {
        throw new Error(`User with the github name '${userName}' not found`)
      }
      const reviewerName = event.requested_reviewer.login
      const reviewer = users.find(u => u.gname === reviewerName)
      if (!reviewer) {
        throw new Error(`User with the github name '${reviewerName}' not found`)
      }
      const text = `${user.name} requested your review on <${pull.url}|PR#${pull.number}>: ${pull.title}`
      const channel = reviewer.sid
      await slackClient.chat.postMessage({ text, channel, as_user: true });
      break
    }
    case 'submitted': {
      console.log(event)
      break
    }
    default: {
      console.log(`EVENT NOT HANDLED: ${event.action}`)
    }
  }
  res.status(204).send()
}))

app.post('/pulls', asyncHandler(async(req, res) => {
  console.log(req.body)
  res.status(204).send()
}))

// Error handler should be placed after all other middlewares
app.use((err, req, res, next) => {
  error = { code: err.code, message: err.message }
  console.error(`ERROR: ${JSON.stringify(error)}`)
  res.status(500).send(error)
})

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`)
})
