import logging
import os.path
import unittest

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    loader = unittest.TestLoader()
    tests = loader.discover(pattern="test_*.py", start_dir=os.path.dirname(__file__))
    runner = unittest.runner.TextTestRunner()
    runner.run(tests)
