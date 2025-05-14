import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  fonts: {
    heading: 'var(--font-inter)',
    body: 'var(--font-inter)',
    mono: 'var(--font-roboto-mono)',
  },
  colors: {
    brand: {
      50: '#fff9db',
      100: '#ffec99',
      200: '#ffe066',
      300: '#ffd43b',
      400: '#fcc419',
      500: '#fab005',
      600: '#e67700',
      700: '#d9480f',
      800: '#c92a2a',
      900: '#a61e4d',
    },
    purple: {
      50: '#f8f0fc',
      100: '#eebefa',
      200: '#e599f7',
      300: '#da77f2',
      400: '#cc5de8',
      500: '#be4bdb',
      600: '#9c36b5',
      700: '#862e9c',
      800: '#702c70',
      900: '#5f3368',
    },
    dark: {
      50: '#f5f6f7',
      100: '#e3e5e8',
      200: '#c1c6cd',
      300: '#9da5af',
      400: '#7b838f',
      500: '#636b78',
      600: '#4b535f',
      700: '#343a45',
      800: '#1e2228',
      900: '#0d0f12',
    }
  },
  styles: {
    global: {
      body: {
        bg: 'dark.900',
        color: 'gray.100',
      },
    },
  },
  components: {
    Button: {
      variants: {
        solid: {
          rounded: 'full',
        },
        outline: {
          rounded: 'full',
        },
      },
    },
    Badge: {
      baseStyle: {
        rounded: 'full',
      },
    },
    Card: {
      baseStyle: {
        rounded: 'xl',
        overflow: 'hidden',
        bg: 'dark.800',
      },
    },
    Heading: {
      baseStyle: {
        color: 'brand.300',
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: 'dark.800',
          color: 'white',
        }
      }
    },
    Input: {
      variants: {
        filled: {
          field: {
            bg: 'dark.700',
            _hover: {
              bg: 'dark.600',
            },
            _focus: {
              bg: 'dark.600',
            }
          }
        }
      },
      defaultProps: {
        variant: 'filled',
      }
    },
  },
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
});

export default theme; 