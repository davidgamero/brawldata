import axios from 'axios'

export let getBrawlStarsAxios = (baseURL, authToken) =>
    axios.create({
        baseURL: baseURL,
        headers: {
            'Authorization': `Bearer  ${authToken}`
        }
    })
