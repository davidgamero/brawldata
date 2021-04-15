import axios from 'axios'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

import { parseApiDateTime } from './util/parseApiDateTime.js'
import { getBrawlStarsAxios } from './net/brawlstarsApi.js'
import { BATTLE_INSERT_QUERY } from './db/battleInsertQuery.js'
import { BATTLES_PLAYERS_INSERT_QUERY } from './db/battlesPlayersInsertQuery.js'
import { PLAYER_INSERT_QUERY } from './db/playerInsertQuery.js'
import { getApiBattleResult } from './util/getApiBattleResult.js'
import { stripPoundSign } from './util/stripPoundSign.js'
import { flipResult } from './util/flipResult.js'

// Check all environment variables are defined
let env_vars = [
  'MYSQL_HOST',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'BRAWLSTARS_AUTH_TOKEN',
  'BRAWLSTARS_ENDPOINT'
];
env_vars.forEach((env_var) => {
  if (process.env[env_var] === undefined) {
    throw (`Undefined environment variable: ${env_var}`);
  }
})

let brawlStarsAxios = getBrawlStarsAxios(process.env.BRAWLSTARS_ENDPOINT, process.env.BRAWLSTARS_AUTH_TOKEN)

const MYSQL_CONNECTION_POOL = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

let myUserId = "92YL98GPG";
let wakaUserId = "8P0RGY9VJ";
let joshUserId = "8YUCQCRU2";

let boisIds = [myUserId, wakaUserId, joshUserId];


let getBrawlers = () => {
  return brawlStarsAxios.get(`brawlers`);
}

let getPlayer = (playertag) => {
  return brawlStarsAxios.get(`players/%23${playerid}`);
}

let getBattleLog = (playertag) => {
  return brawlStarsAxios.get(`players/%23${playertag}/battlelog`);
}


let getStarPowerInfo = (usertag) => {
  let playerPromise = getPlayer(usertag);

  Promise.all([brawlersPromise, playerPromise])
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

      console.log(`=== ${player.name} === `)
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
 * @param {*} userTag 
 */
let updateMatches = (userTag) => {
  return new Promise((resolve, reject) => {
    console.log(`${userTag} | requesting battle log`);

    let battlelogPromise = getBattleLog(userTag);

    battlelogPromise.then((battlelogresponse) => {
      let battles = battlelogresponse.data.items;
      console.log(`${userTag} | recieved battle log with ${battles.length} items`);

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
            dbPlayers = thisBattle.players.filter((p) => p.tag == `#${userTag} `);
            allPlayers = thisBattle.players;
          }

          let allPlayerTags = allPlayers.map((p) => p.tag)

          let primaryPlayerTag = stripPoundSign(allPlayerTags.sort()[0]); // First alphanumeric sorted tag

          let apiBattleTime = metaBattle.battleTime;
          let battleDateTimeString = parseApiDateTime(apiBattleTime);

          console.log(`${userTag} | Processing match ${primaryPlayerTag} @${battleDateTimeString} `)

          let battleInsertParams = [
            primaryPlayerTag,
            battleDateTimeString,
            metaBattle.event.id,
            metaBattle.event.map,
            metaBattle.event.mode || thisBattle.mode,
            thisBattle.duration || null,
            thisBattle.type
          ];

          if (metaBattle.event.id == 0) {
            // These matches have map=null and mode=undefined, so we skip
            console.log(`${userTag} | Skipping event.id = 0 ${primaryPlayerTag} @${battleDateTimeString} `);
          } else if (battleInsertParams.includes(undefined)) {
            // Missing parameters check
            console.log(`${userTag} | Undefined Param ${primaryPlayerTag} @${battleDateTimeString} `);
            console.log(battleInsertParams);
          } else {
            // Write battle row
            let battleInsertPromise = MYSQL_CONNECTION_POOL.execute(
              BATTLE_INSERT_QUERY,
              battleInsertParams
            ).then((rows, err) => {
              console.log(`${userTag} | Battle Done ${primaryPlayerTag} @${battleDateTimeString} `)
            }).catch((err) => {

              if (err.code == 'ER_DUP_ENTRY') {
                // skip duplicate rows
                //console.log(`${userTag} | Duplicate Battle PK ${primaryPlayerTag} @${battleDateTimeString} `)
              } else {
                // Unknown error
                console.log(err);
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
              console.log(`${userTag} | Undefined Param ${primaryPlayerTag} @${battleDateTimeString} `);
              return;
            } else {

              return MYSQL_CONNECTION_POOL.execute(
                PLAYER_INSERT_QUERY,
                [
                  stripPoundSign(p.tag),
                  p.name
                ])
                .then(([rows, fields]) => {
                  console.log(`${userTag} | Players Done ${primaryPlayerTag} @${battleDateTimeString} `)
                })
                .catch((err) => {
                  if (err.code == 'ER_DUP_ENTRY') {
                    //console.log(`${userTag} | Duplicate Player PK ${primaryPlayerTag} @${battleDateTimeString} `)
                  } else {
                    console.log(err);
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
              getApiBattleResult(userTag, p, thisBattle) || null,
              thisBattle.rank || null,
              thisBattle.trophyChange || null
            ];

            if (playerBattleInsertParams.includes(undefined)) {
              console.log(`${userTag} | Undefined Param ${primaryPlayerTag} @${battleDateTimeString} `);
              console.log(playerBattleInsertParams);
              return
            } else {

              return MYSQL_CONNECTION_POOL.execute(
                BATTLES_PLAYERS_INSERT_QUERY,
                playerBattleInsertParams
              )
                .then((rows, err) => {
                  console.log(`${userTag} | Player_Battle Done ${primaryPlayerTag} @${battleDateTimeString} `)
                })
                .catch((err) => {
                  if (err.code == 'ER_DUP_ENTRY') {
                    //console.log(`${userTag} | Duplicate PlayerBattle PK ${primaryPlayerTag} @${battleDateTimeString} `)
                  } else {
                    console.log(err);
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

//updateMatches(myUserId)

let brawlersPromise = getBrawlers();

// Update all players that have polling enabled
MYSQL_CONNECTION_POOL.query(`SELECT * from players where enablePolling = 1`).then(([rows, fields]) => {
  let playerIds = rows.map((row) => row.playerId)
  console.log(`Fetching battles for ${playerIds.length} players mapped`);

  let updateMatchPromises = playerIds.map(id => updateMatches(id));
  Promise.all(updateMatchPromises).then(() => {
    console.log(`done`)
    MYSQL_CONNECTION_POOL.end();
    console.log(`Updated battles for ${playerIds.length} players`);
  })
})