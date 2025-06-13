import { reactive } from 'vue'

export interface Song {
    id: number;
    title: string;
    author: string;
    content: string;
}

class Store {
    songbook: Song[] = [
        { id: 1, title: 'Song 1', author: 'Author 1', content: 'Content 1' },
        { id: 2, title: 'Song 2', author: 'Author 2', content: 'Content 2' },
        { id: 3, title: 'Song 3', author: 'Author 3', content: 'Content 3' },
        { id: 4, title: 'Song 4', author: 'Author 4', content: 'Content 4' },
        { id: 5, title: 'Song 5', author: 'Author 2', content: 'Content 2' },
        { id: 6, title: 'Song 6', author: 'Author 3', content: 'Content 3' },
        { id: 7, title: 'Song 7', author: 'Author 1', content: 'Content 1' },
        { id: 8, title: 'Song 8', author: 'Author 2', content: 'Content 2' },
        { id: 9, title: 'Song 9', author: 'Author 3', content: 'Content 3' },
        { id: 10, title: 'Song 10', author: 'Author 1', content: 'Content 1' },
        { id: 11, title: 'Song 11', author: 'Author 2', content: 'Content 2' },
        { id: 12, title: 'Song 12', author: 'Author 3', content: 'Content 3' },
        { id: 13, title: 'Song 13', author: 'Author 4', content: 'Content 4' },
        { id: 14, title: 'Song 14', author: 'Author 2', content: 'Content 2' },
        { id: 15, title: 'Song 15', author: 'Author 3', content: 'Content 3' },
        { id: 16, title: 'Song 16', author: 'Author 1', content: 'Content 1' },
        { id: 17, title: 'Song 17', author: 'Author 2', content: 'Content 2' },
        { id: 18, title: 'Song 18', author: 'Author 3', content: 'Content 3' },
        { id: 19, title: 'Song 19', author: 'Author 4', content: 'Content 4' },
        { id: 20, title: 'Song 20', author: 'Author 2', content: 'Content 2' }
    ]
    selected: Song | null = null
    view: string = ''
    delete(data: any) {
        this.songbook?.splice(this.songbook.indexOf(data), 1)
    }
    edit(data: any) {
        this.selected = data
        this.view = 'edit'
    }
}

export const store = reactive(new Store())
