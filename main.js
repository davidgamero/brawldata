var axios = require('axios');

var config = {
  method: 'get',
  url: 'https://api.brawlstars.com/v1/brawlers',
  headers: {
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjA5MGY1NTY2LTExYTAtNGExNi1hMzQzLTRiNjc0M2VkYjdiNSIsImlhdCI6MTYxNTQ3ODk3OCwic3ViIjoiZGV2ZWxvcGVyLzc4MWUyYmZlLTU3OTQtMTkyOC0zOTFiLWY0M2I1NTQwZGRjNyIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiOTkuMjMuMTM5Ljk1Il0sInR5cGUiOiJjbGllbnQifV19.FxH0cPZfUYkk5yn1-QeWI3a_fFhU_uAsBV-6cHKTHcdVt7TmypyGMhhmHdjDhk5grEPD8HnClytz4zvslZiYmQ'
  }
};

var playerConfig = (playerid) => ({
  method: 'get',
  url: `https://api.brawlstars.com/v1/players/${playerid}`,
  headers: {
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjA5MGY1NTY2LTExYTAtNGExNi1hMzQzLTRiNjc0M2VkYjdiNSIsImlhdCI6MTYxNTQ3ODk3OCwic3ViIjoiZGV2ZWxvcGVyLzc4MWUyYmZlLTU3OTQtMTkyOC0zOTFiLWY0M2I1NTQwZGRjNyIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiOTkuMjMuMTM5Ljk1Il0sInR5cGUiOiJjbGllbnQifV19.FxH0cPZfUYkk5yn1-QeWI3a_fFhU_uAsBV-6cHKTHcdVt7TmypyGMhhmHdjDhk5grEPD8HnClytz4zvslZiYmQ'
  }
});

let myUserId = "%2392YL98GPG";

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

let brawlers_promise = getBrawlers();
let player_promise = getPlayer(myUserId);

Promise.all([brawlers_promise, player_promise])
  .then(([brawlers, player]) => {
    brawlers = brawlers.items; //nested shenanigans


    let allStarPowers = [];
    brawlers.forEach(brawler => {
      brawler.starPowers.forEach(thisStarPower => {
        allStarPowers.push(thisStarPower);
      })
    });

    let playerStarPowers = [];
    player.brawlers.forEach(brawler => {
      brawler.starPowers.forEach(thisStarPower => {
        playerStarPowers.push(thisStarPower);
      })
    });

    let lvl10brawlers = player.brawlers.filter(b => b.power == 10).length

    console.log(`${player.name}`)
    console.log(`${playerStarPowers.length} / ${allStarPowers.length} star powers unlocked`)
    console.log(`${lvl10brawlers} / ${brawlers.length} lvl 10 brawlers`)
    //console.log(allStarPowers)
    console.log('--')
    //console.log(playerStarPowers)

    console.log('Brawlers under lvl 10: ' + player.brawlers.filter(b => b.power < 10).map(b => b.name))
  })

