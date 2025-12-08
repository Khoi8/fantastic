import axios from 'axios';

const sleeperClient = axios.create({
  baseURL: 'https://api.sleeper.app/v1',
  timeout: 10000,
    headers: {
    'Content-Type': 'application/json',
  },
});

export {
    sleeperClient,
};