import { sleeperClient } from './api';

export const getUserDataWithUserId = (userId: string) => {
    return sleeperClient.get(`/user/${userId}`)
}

export const getUserDataWithUsername = (username: string) => {
    return sleeperClient.get(`/user/${username}`)
}