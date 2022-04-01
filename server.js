const express = require('express')
const cors = require('cors')
require('dotenv').config()
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express()

// Setup necessary middlewares
app.use(cors())
  .use(express.static('public'))
  .use(bodyParser.urlencoded({ extended: false }));

// Setup our User model
let User = new mongoose.model("User", new mongoose.Schema({
  username: { type: String, required: true }
}));

// Setup Excersise model
let Exercise = new mongoose.model("Exercise", new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  username: { type: String, required: true },
}));

/**
 * GET user's exercise log
 * GET /api/users/:_id/logs?[from][&amp;to][&amp;limit]
 */
app.get('/api/users/:_id/logs', (req, res) => {
  console.log(req.query);
  // Find the user..
  User.findById(req.params._id, (err, user) => {
    if (err) {
      res.json({ error: err }); res.end();
    }

    if (!user) {
      res.json({ user: user, error: err }); res.end();
    }

    const match = { username: user.username };
    if (req.query?.from && req.query?.to) {
      match.date = { $gte: new Date(req.query.from), $lte: new Date(req.query.to) };
    } else if (req.query?.from) {
      match.date = { $gte: new Date(req.query.from) };
    }
    else if (req.query?.to) {
      match.date = { $lte: new Date(req.query.to) };
    }

    console.log(match);

    let exerciseAggregate = Exercise.aggregate()
      .match(match)
      .project({
        description: 1,
        duration: 1,
        date: {
          $function: {
            // https://stackoverflow.com/a/63739304/380138 - function should be quoted
            body: `function (isoDate) {
              return new Date(isoDate).toDateString();
            }`,
            args: ["$date"],
            lang: "js"
          }
        },
      });

    if (req.query?.limit) {
      exerciseAggregate.limit(Number(req.query.limit));
    }

    exerciseAggregate
      .exec((err, exercises) => {
        if (err) {
          res.json({ error: err });
          res.end();
        }

        res.json({
          username: user.username,
          count: exercises?.length,
          log: exercises
        });
      });
  });
});

/**
 * Get all users
 * GET /api/users
 * 
 * Create a new user
 * POST /api/users
 */
app.route('/api/users')
  .get((_, res) => {
    User.find({}, (err, users) => {
      if (err) {
        res.json({ error: err }); res.end();
      }

      res.json(users);
    })
  })
  .post((req, res) => {
    if (req.body?.username) {
      new User({ username: req.body?.username })
        .save((err, user) => {
          if (err) {
            res.json({ error: err }); res.end();
          }

          res.json(user);
        });
    } else {
      res.json({ error: "username is required." });
    }
  });

/**
 * Add exercises
 * POST POST /api/users/:_id/exercises
 */
app.post('/api/users/:_id/exercises', (req, res) => {
  const params = req.body;

  // Find the user..
  User.findById(req.params._id, (err, user) => {
    if (err) {
      res.send({ error: err }); res.end();
    }

    if (user?.username) {
      // Lets save against the user..
      new Exercise({
        description: params.description, date: (params?.date ? new Date(params.date) : new Date()),
        duration: Number(params.duration), username: user.username
      }).save((err, exercise) => {
        if (err) {
          res.send({ error: err }); res.end();
        }

        // send json response...
        res.json({
          username: exercise.username,
          description: exercise.description?.toString(),
          duration: exercise.duration,
          date: new Date(exercise.date).toDateString(),
          _id: user._id
        });
      });
    } else {
      res.send({ error: err }); res.end();
    }
  });
});

/**
 * index page
 */
app.get('/', (_, res) => {
  res.sendFile(__dirname + '/views/index.html')
});





let listener;

// Connect to the moongoose server
mongoose.connect(process.env.MONGO_URI).then(_ => {
  // Listen for requests
  listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener?.address()?.port)
  });
}).catch(err => {
  // No need to start listening if we cant connect to db..
  console.log('Error while trying to connect to the database', err);
});

