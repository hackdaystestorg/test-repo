const express = require('express')
const asyncHandler = require('express-async-handler')
const { Octokit } = require("@octokit/rest")
const { WebClient } = require('@slack/web-api')

const port = process.env.PORT
const githubToken = process.env.GITHUB_TOKEN
const slackToken = process.env.SLACK_TOKEN
const users = JSON.parse(Buffer.from(process.env.USERS, 'base64').toString('ascii'))

const app = express()
const github = new Octokit({ auth: githubToken })
const slack = new WebClient(slackToken)

const searchPullRequests = async (organizationName, userName) => {
  let reviewRequestedPulls = []
  let reviewedPulls = []
  let requests = []

  const query1 = `is:pr is:open org:${organizationName} review-requested:${userName} sort:created-asc`
  requests.push(github.search.issuesAndPullRequests({ q: query1 }))

  const query2 = `is:pr is:open org:${organizationName} reviewed-by:${userName} sort:created-asc`
  requests.push(github.search.issuesAndPullRequests({ q: query2 }))

  const results = await Promise.all(requests)

  results[0].data.items.forEach(item => {
    const { html_url, number, title } = item
    const organizationName = html_url.replace('https://github.com/', '').split('/')[0]
    const pull = { organizationName, url: html_url, number, title }
    reviewRequestedPulls.push(pull)
  })

  results[1].data.items.forEach(item => {
    if (item.user.login === userName) {
      return
    }
    const { html_url, number, title } = item
    const organizationName = html_url.replace('https://github.com/', '').split('/')[0]
    const pull = { organizationName, url: html_url, number, title }
    reviewedPulls.push(pull)
  })

  return { reviewRequested: reviewRequestedPulls, reviewed: reviewedPulls }
}

const convertPullRequestsToString = (pulls) => {
  if (pulls.length > 0) {
    return pulls.map(pull => `• <${pull.url}|${pull.title}>`).join('\n')
  } else {
    return 'There are no such pull requests :tada:'
  }
}

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.post('/events', asyncHandler(async (req, res) => {
  const event = req.body
  switch (event.action) {
    case 'review_requested': {
      const pull = event.pull_request
      const userName = pull.user.login
      const user = users.find(u => u.gname === userName)
      if (!user) {
        throw new Error(`User with the Github name '${userName}' not found`)
      }
      const reviewerName = event.requested_reviewer.login
      const reviewer = users.find(u => u.gname === reviewerName)
      if (!reviewer) {
        throw new Error(`User with the Github name '${reviewerName}' not found`)
      }
      const text = `${user.name} requested your review on <${pull.url}|PR#${pull.number}>: ${pull.title}`
      const channel = reviewer.sid
      await slack.chat.postMessage({ text, channel, as_user: true });
      break
    }
    default: {
      console.log(`EVENT NOT HANDLED: ${event.action}`)
    }
  }
  res.status(204).send()
}))

app.post('/pulls', asyncHandler(async(req, res) => {
  const { user_id } = req.body
  const user = users.find(u => u.sid === user_id)
  if (!user) {
    throw new Error(`User with the Slack ID '${user_id}' not found`)
  }
  const carnivalPulls = await searchPullRequests('carnivalmobile', user.gname)
  const sailthruPulls = await searchPullRequests('sailthru', user.gname)
  const message = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Pull requests waiting for your review'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*carnivalmobile*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Review requested:\n${convertPullRequestsToString(carnivalPulls.reviewRequested)}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Reviewed:\n${convertPullRequestsToString(carnivalPulls.reviewed)}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*sailthru*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Review requested:\n${convertPullRequestsToString(sailthruPulls.reviewRequested)}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Reviewed:\n${convertPullRequestsToString(sailthruPulls.reviewed)}`
        }
      }
    ]
  }
  res.status(200).send(message)
}))

// Error handler should be placed after all other middlewares
app.use((err, req, res, next) => {
  const json = { code: err.code, message: err.message }
  console.error(`ERROR: ${JSON.stringify(json)}`)
  res.status(500).send(json)
})

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`)
})
