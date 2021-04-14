export const BATTLES_PLAYERS_INSERT_QUERY = `
    INSERT INTO battles_players
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
`