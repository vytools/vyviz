#!/usr/bin/env python
import setuptools, re

try:
    with open('README.md','r') as f:
        readme = f.read()
except Exception as exc:
    readme = ''

setuptools.setup(name='vyviz',
    description='Visualization tools for working with vy',
    long_description=readme,
    license='MIT',
    author='Nate Bunderson',
    author_email='nbunderson@gmail.com',
    url='https://github.com/NateBu/vyviz',
    keywords = ["vy", "vytools", "vyviz"],
    classifiers = [
        "Programming Language :: Python",
        "Development Status :: 2 - Pre-Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Topic :: Other/Nonlisted Topic"
    ],
    python_requires='>=3.6',
    packages=setuptools.find_packages(),
    package_data = {'vyviz': ['base/*']},
    install_requires=[
        'sanic_cors==0.10.0.post3',
        'vytools>=0.2.15'
    ],
    entry_points={
        'console_scripts':[
            'vyviz=vyviz:_commandline'
        ]
    },
    setup_requires=['pytest-runner'],
    tests_require=['pytest'],
)

