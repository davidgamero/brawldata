var axios = require('axios');
const mysql = require('mysql2');
require('dotenv').config(); // load environment variables

authToken = process.env.BRAWLSTARS_AUTH_TOKEN

const MYSQL_CONNECTION_POOL = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const BRAWLSTARS_ENDPOINT = 'https://api.brawlstars.com/v1'

let stripPoundSign = (tag) => tag.replace(/[#]/g, '');

var config = {
  method: 'get',
  url: `${BRAWLSTARS_ENDPOINT}/brawlers`,
  headers: {
    'Authorization': authToken
  }
};

var playerConfig = (playerid) => ({
  method: 'get',
  url: `${BRAWLSTARS_ENDPOINT}/players/${playerid}`,
  headers: {
    'Authorization': authToken
  }
});

var battleLogConfig = (playerid) => ({
  method: 'get',
  url: `${BRAWLSTARS_ENDPOINT}/players/${playerid}/battlelog`,
  headers: {
    'Authorization': authToken
  }
});

let myUserId = "%2392YL98GPG";
let wakaUserId = "%238P0RGY9VJ";
let joshUserId = "%238YUCQCRU2";

let boisIds = [myUserId, wakaUserId, joshUserId];

let getBrawlers = () => {
  return new Promise((resolve, reject) => {
    axios(config)
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        console.log(error);
        reject(error);
      });
  })
}

let getPlayer = (playerid) => {
  return new Promise((resolve, reject) => {
    axios(playerConfig(playerid))
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        console.log(error);
        reject(error);
      });
  })
}

let getBattleLog = (playerid) => {
  return new Promise((resolve, reject) => {
    axios(battleLogConfig(playerid))
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        console.log(error);
        reject(error);
      });
  })
}

let brawlers_promise = getBrawlers();

let getStarPowerInfo = (userid) => {
  let player_promise = getPlayer(userid);

  Promise.all([brawlers_promise, player_promise])
    .then(([brawlers, player]) => {
      brawlers = brawlers.items; //nested shenanigans

      // Every star power in the game
      let allStarPowers = [];
      brawlers.forEach(brawler => {
        brawler.starPowers.forEach(thisStarPower => {
          allStarPowers.push(thisStarPower);
        })
      });

      // Star powers the player has unlocked
      let playerStarPowers = [];
      player.brawlers.forEach(brawler => {
        brawler.starPowers.forEach(thisStarPower => {
          playerStarPowers.push(thisStarPower);
        })
      });

      // Count level 10 brawlers
      let lvl10brawlers = player.brawlers.filter(b => b.power == 10).length

      console.log(`=== ${player.name} ===`)
      console.log(`${playerStarPowers.length} / ${allStarPowers.length} star powers unlocked`)
      console.log(`${lvl10brawlers} / ${brawlers.length} lvl 10 brawlers`)
      //console.log(allStarPowers)
      //console.log(playerStarPowers)

      console.log('Brawlers under lvl 10: ' + player.brawlers.filter(b => b.power < 10).map(b => b.name))
      console.log(' ')
    })
}

/**
 * Query matches for player and insert into MySQL
 * @param {*} userid 
 */
let updateMatches = (userid) => {
  let battlelogPromise = getBattleLog(userid);
  battlelogPromise.then((battlelogresponse) => {
    let battles = battlelogresponse.items;

    battles.forEach((metaBattle) => {
      let thisBattle = metaBattle.battle; // Extract layer from JSON
      console.log(thisBattle);

      let players = thisBattle.teams[0].concat(thisBattle.teams[1])
      let playerTags = players.map((p) => p.tag)

      let primaryPlayerTag = stripPoundSign(playerTags.sort()[0]); // First alphanumeric sorted tag
      console.log(players)

      bt = metaBattle.battleTime;
      let battleDateTimeString = bt.substr(0, 4) + '-' +
        bt.substr(4, 2) + '-' +
        bt.substr(6, 2) + ' ' +
        bt.substr(9, 2) + ':' +
        bt.substr(11, 2) + ':' +
        bt.substr(13, 2);

      // Write battle row
      MYSQL_CONNECTION_POOL.execute(`
        INSERT INTO battles
        (
          primaryPlayerTag,
          battleTime,
          eventId,
          map,
          mode,
          duration,
          type
        )
        VALUES
        (
          '${primaryPlayerTag}',
          '${battleDateTimeString}',
          ${metaBattle.event.id},
          '${metaBattle.event.map}',
          '${metaBattle.event.mode}',
          ${thisBattle.duration},
          '${thisBattle.type}'
        )
        `, (err, rows) => {
        if (err) {
          console.log(err);
        }
        console.log(rows);
      })

      // Write player rows
      players.forEach((p) => {
        MYSQL_CONNECTION_POOL.execute(`
        INSERT INTO players
        (
          playerId,
          name
        )
        VALUES
        (
          '${stripPoundSign(p.tag)}',
          '${p.name}'
        )
        `, (err, rows) => {
          if (err) {
            console.log(err);
          }
        })
      })

      // Write Player Battle join table
      // Write player rows
      players.forEach((p) => {
        MYSQL_CONNECTION_POOL.execute(`
          INSERT INTO battles_players
          (
            primaryPlayerTag,
            playerId,
            battleTime,
            brawlerId,
            brawlerName,
            brawlerPower,
            trophies
          )
          VALUES
          (
            '${primaryPlayerTag}',
            '${stripPoundSign(p.tag)}',
            '${battleDateTimeString}',
            ${p.brawler.id},
            '${p.brawler.name}',
            ${p.brawler.power},
            ${p.brawler.trophies}
          )
          `, (err, rows) => {
          if (err) {
            console.log(err);
          }
        })
      })

    })

  })

}

//boisIds.forEach(id => getStarPowerInfo(id))

updateMatches(myUserId)

// MYSQL_CONNECTION_POOL.query(`select * from players`, (err, rows, fields) => {
//   rows.forEach((row) => {
//     console.log(row);
//   })
// })