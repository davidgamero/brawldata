import { stripPoundSign } from './stripPoundSign.js'
import { flipResult } from './flipResult.js'

/**
 * Extract the result of a battle for a specified player
 * @param {*} queryUserTag The user for which the battlelog was queried 
 * @param {*} player The specified player whos result we are extracting
 * @param {*} battle The battlelog battle object
 */
export const getApiBattleResult = (queryUserTag, player, battle) => {
  let playerTag = stripPoundSign(player.tag); // Extract specified player's tag for comparison

  // Avoid showdown games or errors in transmission
  if (!battle.teams || battle.teams.length != 2) {
    return null;
  }

  // Extract the teams' tags into arrays of strings
  let team0tags = battle.teams[0].map((p) => stripPoundSign(p.tag));
  let team1tags = battle.teams[1].map((p) => stripPoundSign(p.tag));

  // Get team number of specified player
  let getTeamNumber = (tag) => team0tags.includes(tag) ? 0 : 1;

  // Check if queried player and specified player are on same team
  if (getTeamNumber(playerTag) == getTeamNumber(queryUserTag)) {
    // If so, they have the same result
    return battle.result;
  } else {
    // Else the specified player has the inverse of the result
    return flipResult(battle.result);
  }
}