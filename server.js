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
    const filter = { username: user.username };
    if (req.query?.from !== undefined) {
      filter.from = { $gte: req.query.from };
    }
    if (req.query?.to !== undefined) {
      filter.to = { $lte: req.query.to };
    }

    // let logs = await Exercise.aggregate([
    //   { $match: filter }, // Select conditions
    //   {
    //     $project: {
    //       desc: 1,
    //       duration: 1,
    //       date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
    //     }
    //   } // Fields we want selected
    // ]);

    let exerciseAggregate = Exercise.aggregate()
      .match(filter)
      .project({
        desc: 1,
        duration: 1,
        date: {
          $function: {
            body: `function (isoDate) {
              return new Date(d).toDateString();
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
          logs: exercises
        });
      });

    // Exercise.aggregate([
    //   { $match: filter }, // Select conditions
    //   {
    //     $project: {
    //       desc: 1,
    //       duration: 1,
    //       date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
    //     }
    //   } // Fields we want selected
    // ]).then((e, d) => {

    // });

    // res.json({
    //   username: user.username,
    //   count: logs.length,
    //   logs: logs
    // });

  });
});

/**
 * Create a new user
 * POST /api/users
 */
app.post('/api/users', (req, res) => {
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
  console.log(params);

  // Find the user..
  User.findById(params[':_id'], (err, user) => {
    if (err) {
      res.send({ error: err }); res.end();
    }

    // Lets save against the user..
    new Exercise({
      description: params.description, date: new Date(params.date),
      duration: Number(params.duration), username: user.username
    }).save((err, exercise) => {
      if (err) {
        res.send({ error: err }); res.end();
      }

      // send json response...
      res.json(exercise);
    });
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

