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

module.exports = parseApiDateTime;