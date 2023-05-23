import unittest
import os.path
import logging

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    loader = unittest.TestLoader()
    tests = loader.discover(pattern="test_*.py", start_dir=os.path.dirname(__file__))
    runner = unittest.runner.TextTestRunner()
    runner.run(tests)
