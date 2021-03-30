var axios = require('axios');
const mysql = require('mysql2/promise');
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
  url: `${BRAWLSTARS_ENDPOINT}/players/%23${playerid}`,
  headers: {
    'Authorization': authToken
  }
});

var battleLogConfig = (playerid) => ({
  method: 'get',
  url: `${BRAWLSTARS_ENDPOINT}/players/%23${playerid}/battlelog`,
  headers: {
    'Authorization': authToken
  }
});

let myUserId = "92YL98GPG";
let wakaUserId = "8P0RGY9VJ";
let joshUserId = "8YUCQCRU2";

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

let getPlayer = (playertag) => {
  return new Promise((resolve, reject) => {
    axios(playerConfig(playertag))
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        console.log(error);
        reject(error);
      });
  })
}

let getBattleLog = (playertag) => {
  return new Promise((resolve, reject) => {
    axios(battleLogConfig(playertag))
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

let getStarPowerInfo = (usertag) => {
  let player_promise = getPlayer(usertag);

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

const flipResult = (result) => result == 'defeat' ? 'victory' : 'defeat';

let getResult = (queryUserTag, player, battle) => {
  let playerTag = stripPoundSign(player.tag);

  if (!battle.teams || battle.teams.length != 2) {
    return null; // showdown games or errors in transmissioin
  }
  let team0tags = battle.teams[0].map((p) => stripPoundSign(p.tag));
  let team1tags = battle.teams[1].map((p) => stripPoundSign(p.tag)); // not used, maybe assert a sanity check

  let getTeamNumber = (tag) => team0tags.includes(tag) ? 0 : 1;

  if (getTeamNumber(playerTag) == getTeamNumber(queryUserTag)) {
    return battle.result;
  } else {
    return flipResult(battle.result);
  }
}

/**
 * The stupid API format doesn't folllow ISO standard so we gotta do this gross shit
 * @param apiDateTime 
 */
let parseApiDateTime = (apiDateTime) => {
  let bt = apiDateTime;

  let parsed = bt.substr(0, 4) + '-' +
    bt.substr(4, 2) + '-' +
    bt.substr(6, 2) + ' ' +
    bt.substr(9, 2) + ':' +
    bt.substr(11, 2) + ':' +
    bt.substr(13, 2);

  return parsed;
}

/**
 * Query matches for player and insert into MySQL
 * @param {*} userTag 
 */
let updateMatches = (userTag) => {
  return new Promise((resolve, reject) => {
    console.log(`${userTag} | requesting battle log`);

    let battlelogPromise = getBattleLog(userTag);

    battlelogPromise.then((battlelogresponse) => {
      console.log(`${userTag} | recieved battle log with ${battlelogresponse.items.length} items`);
      let battles = battlelogresponse.items;

      let battlePromises = battles.map((metaBattle) => {
        return new Promise((resolve, reject) => {
          let thisBattle = metaBattle.battle; // Extract layer from JSON

          let mySQLPromises = [];

          let dbPlayers = []; // players to be added to the database
          let allPlayers = []; // all players even ones not for database
          if (thisBattle.teams) {
            allPlayers = thisBattle.teams.flat();
            dbPlayers = thisBattle.teams.flat();
          } else {
            // for solo showdown only include requested player
            dbPlayers = thisBattle.players.filter((p) => p.tag == `#${userTag}`);
            allPlayers = thisBattle.players;
          }

          let allPlayerTags = allPlayers.map((p) => p.tag)

          let primaryPlayerTag = stripPoundSign(allPlayerTags.sort()[0]); // First alphanumeric sorted tag

          let apiBattleTime = metaBattle.battleTime;
          let battleDateTimeString = parseApiDateTime(apiBattleTime);

          console.log(`${userTag} | Processing match ${primaryPlayerTag} @${battleDateTimeString}`)

          let battleInsertParams = [
            primaryPlayerTag,
            battleDateTimeString,
            metaBattle.event.id,
            metaBattle.event.map,
            metaBattle.event.mode,
            thisBattle.duration || null,
            thisBattle.type
          ];

          if (battleInsertParams.includes(undefined)) {
            console.log(`${userTag} | Undefined Param ${primaryPlayerTag} @${battleDateTimeString}`);
            console.log(battleInsertParams);
          } else {
            // Write battle row
            let battleInsertPromise = MYSQL_CONNECTION_POOL.execute(`
              INSERT IGNORE INTO battles
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
                ?,?,?,?,?,?,?
              )
              `,
              battleInsertParams
            ).then((rows, err) => {
              console.log(`${userTag} | Battle Done ${primaryPlayerTag} @${battleDateTimeString}`)
            }).catch((err) => {
              console.log(err);
              if (err.code == 'ER_DUP_ENTRY') {
                console.log(`${userTag} | Duplicate Battle PK ${primaryPlayerTag} @${battleDateTimeString}`)
              }
            });
            mySQLPromises.push(battleInsertPromise);
          }


          // Write player rows
          let playerInsertPromises = dbPlayers.map((p) => {
            let playerInsertParams = [
              stripPoundSign(p.tag),
              p.name
            ];

            if (playerInsertParams.includes(undefined)) {
              console.log(`${userTag} | Undefined Param ${primaryPlayerTag} @${battleDateTimeString}`);
              return;
            } else {

              return MYSQL_CONNECTION_POOL.execute(`
              INSERT IGNORE INTO players
              (
                playerId,
                name
              )
              VALUES
              (
                ?,?
              )
              `,
                [
                  stripPoundSign(p.tag),
                  p.name
                ])
                .then(([rows, fields]) => {
                  console.log(`${userTag} | Players Done ${primaryPlayerTag} @${battleDateTimeString}`)
                })
                .catch((err) => {
                  console.log(err);
                  if (err.code == 'ER_DUP_ENTRY') {
                    console.log(`${userTag} | Duplicate Player PK ${primaryPlayerTag} @${battleDateTimeString}`)

                  }
                })
            }
          });
          mySQLPromises.concat(playerInsertPromises);


          // Write Player Battle join table
          // Write player rows


          let playerBattleInsertPromises = dbPlayers.map((p) => {

            let playerBattleInsertParams = [
              primaryPlayerTag,
              stripPoundSign(p.tag),
              battleDateTimeString,
              p.brawler.id,
              p.brawler.name,
              p.brawler.power,
              p.brawler.trophies,
              getResult(userTag, p, thisBattle) || null,
              thisBattle.rank || null,
              thisBattle.trophyChange || null
            ];

            if (playerBattleInsertParams.includes(undefined)) {
              console.log(`${userTag} | Undefined Param ${primaryPlayerTag} @${battleDateTimeString}`);
              console.log(playerBattleInsertParams);
              return
            } else {

              return MYSQL_CONNECTION_POOL.execute(`
                INSERT IGNORE INTO battles_players
                (
                  primaryPlayerTag,
                  playerId,
                  battleTime,
                  brawlerId,
                  brawlerName,
                  brawlerPower,
                  trophies,
                  result,
                  rank,
                  trophyChange
                )
                VALUES
                (
                  ?,?,?,?,?,?,?,?,?,?
                )
                `,
                playerBattleInsertParams
              )
                .then((rows, err) => {
                  console.log(`${userTag} | Player_Battle Done ${primaryPlayerTag} @${battleDateTimeString}`)
                })
                .catch((err) => {
                  console.log(err);
                  if (err.code == 'ER_DUP_ENTRY') {
                    console.log(`${userTag} | Duplicate PlayerBattle PK ${primaryPlayerTag} @${battleDateTimeString}`)

                  }
                })
            }
          });
          mySQLPromises.concat(playerBattleInsertPromises);

          // Allow all MySQL Insertions to complete
          Promise.all(mySQLPromises).then(() => {
            resolve();
          })
        })
      })

      Promise.all(battlePromises).then(() => {
        resolve();
      })
    })
  })
}

//boisIds.forEach(id => getStarPowerInfo(id))
console.log('starting')
let updateMatchPromises = boisIds.map(id => updateMatches(id));

Promise.all(updateMatchPromises).then(() => {
  console.log(`done`)
  MYSQL_CONNECTION_POOL.end();
  process.exit();
})

//updateMatches(myUserId)

// MYSQL_CONNECTION_POOL.query(`select * from players`).then(([rows, fields]) => {
//   let playerIds = rows.map((row) => row.playerId);
//   console.log(`Fetching matches for ${playerIds.length} players mapped`);

//   let updateMatchPromises = playerIds.map(id => updateMatches(id));
//   Promise.all(updateMatchPromises).then(() => {
//     console.log(`done`)
//     MYSQL_CONNECTION_POOL.end();
//     console.log(`Updated matches for ${playerIds.length} players`);
//   })
// })