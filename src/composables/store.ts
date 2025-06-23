import { reactive } from 'vue'

export interface Song {
    id: number;
    title: string;
    artist: string;
    content: string;
}

class Store {
    songbook: Song[] = []
    selected: Song | null = null
    view: string = ''
    apiKey: string = ''
    edit(id: number) {
        this.selectSong(id)
        this.view = 'edit'
    }
    show(id: number) {
        this.selectSong(id)
        this.view = 'show'
    }
    selectSong(id: number) {
        const index = this.songbook.findIndex(song => song.id === id)
        this.selected = index !== -1 ? this.songbook[index] : null
    }
    deleteSong(id: number) {
        const index = this.songbook.findIndex(song => song.id === id)
        if (index !== -1) {
            this.songbook.splice(index, 1)
        }
        this.selected = null
    }
    saveSongbook() {
        localStorage.setItem("songbook", JSON.stringify(this.songbook))
    }
    loadSongbook() {
        this.songbook = JSON.parse(localStorage.getItem("songbook") || '[]') 
    }
    saveApiKey() {
        localStorage.setItem("apiKey", this.apiKey)
    }
    loadApiKey() {
        this.apiKey = localStorage.getItem("apiKey") || ''
    }
    addSong() {
        this.selected = {
            id: this.songbook.length,
            title: 'New song',
            artist: 'Artist',
            content: '# New song - Artist\n1. Verse  \n~Chorus Chorus  \n',
        }
        this.view = 'edit'
    }
}

const store = reactive(new Store())
store.loadSongbook()
store.loadApiKey()
export default store