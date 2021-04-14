export let BATTLE_INSERT_QUERY = `
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
        ?,?,?,?,?,?,?
    )
`