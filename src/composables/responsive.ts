import { onMounted, onUnmounted, reactive, toRefs } from "vue";

const useResponsive = () => {
    const sizes = reactive({
        browserWidth: window.innerWidth,
        deviceWidth: screen.width,
        isMobile: false
    })

    
    const browserResized = () => {
        sizes.browserWidth = window.innerWidth
        sizes.deviceWidth = screen.width
        sizes.isMobile = isMobile()
    }

    const isMobile = () => {
        return window.innerWidth <= 800 ? true : false
    }

    onMounted(() => {
        window.addEventListener('resize', browserResized)
    })

    onUnmounted(() => {
        window.removeEventListener('resize', browserResized)
    })

    return {
        ...toRefs(sizes),
    }
}

export default useResponsive;
