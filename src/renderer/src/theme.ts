import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false
  },
  colors: {
    brand: {
      50: '#e8f1fd',
      100: '#c5ddf8',
      200: '#9ec7f2',
      300: '#75b0ea',
      400: '#4f9de3',
      500: '#3182ce',
      600: '#2b6cb0',
      700: '#2c5282',
      800: '#2a4365',
      900: '#1a365d'
    }
  }
})

export default theme
