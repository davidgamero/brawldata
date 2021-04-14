export const PLAYER_INSERT_QUERY = `
    INSERT INTO players
    (
        playerId,
        name
    )
    VALUES
    (
        ?,?
    )
`