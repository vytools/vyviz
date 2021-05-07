import vyviz.server
import vytools

__version__ = "0.0.1"

def _commandline():
  import argparse, shlex, os, logging
  parser = argparse.ArgumentParser(prog='vyviz', description='Visualization tools for working with vy')
  parser.add_argument('--version','-v', action='store_true', help='Print version')
  parser.add_argument('--port', type=int, default=17171, help='server port number')
  args = parser.parse_args()
  if args.version:
    print(__version__)
    return
  vytools.scan()
  vyviz.server.server(port=args.port)

if __name__ == '__main__':
  _commandline()