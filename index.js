const express = require('express')
const app = express()
const port = process.env.PORT || 8000

app.use(express.json())

app.get('/', (_, res) => {
  res.send('Hello World!')
})

app.post('/events', (req, res) => {
  console.log(req.body)
  res.status(204)
})

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`)
})
