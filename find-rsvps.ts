#!/usr/bin/env ts-node

import axios from 'axios';
import dateFormat from 'dateformat';

const meetupUrlName = "Silicon-Throwabout";
const eventName = "Indoor Ultimate Frisbee in *Hackney Community College* on Thursday evenings";
const eventsDateRange = {from: "2021-09-01T00:00:00.000", to: "2022-05-01T00:00:00.000"};

type MeetupEvent = {
  id: string
  name: string
  local_date: string
  link: string
}

function getEvents(meetupUrlName: string, eventName: string): Promise<MeetupEvent[]> {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events?no_earlier_than=${eventsDateRange.from}&no_later_than=${eventsDateRange.to}&status=past,upcoming`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data.filter((e: MeetupEvent) => {
      return e.name === eventName;
    });
  }).catch(err => {
    console.log(err);
  });
}

function printLine() {
  console.log(`\n------------------------------------------------------------------------------`);
}

function updateEventAttendees(eventInfo, updatingExistingData: boolean): boolean {
  if (!updatingExistingData) {
    return true;
  }
  if (process.argv[3] && process.argv[3].split(",").map(x => x.trim()).includes(eventDataFormatted(eventInfo))) {
    return true;
  }
  return eventInfo.eventData.status === "upcoming";
}

function eventDataFormatted(eventInfo) {
  let date = eventInfo.eventData.local_date;
  return dateFormat(date, "dd/mm/yy");
}

let namesByMemberId = {};

function getRsvps(meetupUrlName: string, eventId: string) {
  return axios({
    method: 'get',
    url: `https://api.meetup.com/${meetupUrlName}/events/${eventId}/rsvps`,
    headers: { 'Accept': 'application/json' },
  }).then(response => {
    return response.data
        .filter(element => element.response === "yes")
        .map(element => {
          namesByMemberId[element.member.id] = element.member.name;
          return {
            name: element.member.name,
            id: element.member.id,
          };
        });
  }).catch(err => {
    console.log(err);
  })
}

type Person = {id: number, name: string}
type EventInfo = {
  attendeeNames: string[]
  attendeeIds: number[]
  attendees: Person[]
  eventData: MeetupEvent
};

let infoByEventDate: {[eventDate: string]: EventInfo} = {};
let orderedEventDates: string[] = [];
let sessionsByPerson: {[attendeeId: number]: string[]}  = {};

getEvents(meetupUrlName, eventName).then(events => {
  return Promise.all(events.map(event => {
    let eventDate = dateFormat(event.local_date, "dd/mm/yy");
    orderedEventDates.push(eventDate);
    infoByEventDate[eventDate] = {
      eventData: event,
      attendeeNames: [],
      attendeeIds: [],
      attendees: [],
    };

    let attendeePromise = getRsvps(meetupUrlName, event.id);
    attendeePromise.then(attendees => {
      attendees.forEach(attendee => {
        infoByEventDate[eventDate].attendeeNames.push(attendee.name);
        infoByEventDate[eventDate].attendeeIds.push(attendee.id);
        infoByEventDate[eventDate].attendees.push(attendee);
        if (!sessionsByPerson.hasOwnProperty(attendee.id)) {
          sessionsByPerson[attendee.id] = [];
        }
        sessionsByPerson[attendee.id].push(event.local_date);
      });
    });
    return attendeePromise;
  }));
}).then(() => {
  console.log(infoByEventDate)
  printLine();
  console.log(`Session info by event`);
  orderedEventDates.forEach(eventDate => {
    let info = infoByEventDate[eventDate];
    let attendeeCount = info.attendeeIds.length;
    let attendees = info.attendeeNames.join(", ");
    console.log(`${eventDataFormatted(info)}: ${18 - attendeeCount} spaces left - (${attendees})`);
  });

  printLine();
  console.log(`Session links by event`);
  orderedEventDates.forEach(eventDate => {
    let info = infoByEventDate[eventDate];
    console.log(`- ${eventDataFormatted(info)}: ${info.eventData.link}`);
  });

  printLine();
  console.log(`Session count by person`);
  let attendeeIds = Object.keys(sessionsByPerson).map(x => +x);
  attendeeIds.sort(function (a, b) {
    return sessionsByPerson[b].length - sessionsByPerson[a].length;
  });
  attendeeIds.forEach(function (attendeeId) {
    let sessions = sessionsByPerson[attendeeId];
    console.log(`${namesByMemberId[attendeeId]} (${attendeeId}): ${sessions.length} (£${sessions.length * 5})`);
  });

  let personIds = Object.keys(sessionsByPerson).map(x => +x);
  personIds.sort(function (a, b) {
    return namesByMemberId[a].localeCompare(namesByMemberId[b]);
  });
  
  let matrixRows = [];

  console.log(orderedEventDates);


  let existingSheet: string[][] = null;
  let peopleAlreadyInSheet: Person[] = [];
  let updatingExistingData = false;
  if (process.argv[2]) {
    let existingSheetWithHeaders = process.argv[2].split("\n").map(row => row.split("\t"));
    let existingLinkRow = existingSheetWithHeaders[0];
    let existingDateRow = existingSheetWithHeaders[1];
    orderedEventDates = existingDateRow.slice(2);

    // links change (why?) this updates them to the latest link we got from meetup
    let i = 2;
    while(i < existingLinkRow.length) {
      let eventInfo = infoByEventDate[existingDateRow[i]]
      if(eventInfo) {
        existingLinkRow[i] = eventInfo.eventData.link;
      }
      i++;
    }

    matrixRows.push(existingLinkRow);
    matrixRows.push(existingDateRow);

    existingSheet = existingSheetWithHeaders.slice(2);
    peopleAlreadyInSheet = existingSheet.map(row => ({name: row[0], id: +row[1]}));
    updatingExistingData = true;
  } else {
    let linkRow = ["https://tinyurl.com/SiThrowabout", ""];
    let dateRow = ["", ""];
    orderedEventDates.forEach(eventDate => {
      linkRow.push(infoByEventDate[eventDate].eventData.link + "attendees");
      dateRow.push(eventDate);
    });
    matrixRows.push(linkRow);
    matrixRows.push(dateRow);
  }

  peopleAlreadyInSheet.forEach((person, i) => {
    let existingRow = existingSheet[i].slice(2); // remove name and id cells
    let row = [person.name, person.id];
    orderedEventDates.forEach((eventDate, j) => {
      let eventInfo = infoByEventDate[eventDate];
      if (!eventInfo) {
        row.push(existingRow[j]);
      } else {
        let attending = eventInfo.attendeeIds.some(x => x === person.id);
        if (updateEventAttendees(eventInfo, updatingExistingData)) {
          let wasGoing = existingRow[j] === 'y' || existingRow[j] === 'd';
          row.push(attending ? 'y' : (wasGoing ? 'd' : 'n'));
        } else {
          row.push(existingRow[j]);
        }
      }
    });
    matrixRows.push(row);
  });

  personIds.filter(x => !peopleAlreadyInSheet.map(x => x.id).includes(x)).forEach(personId => {
    let row = [namesByMemberId[personId], personId];
    orderedEventDates.forEach(eventDate => {
      let eventInfo = infoByEventDate[eventDate];
      if (!eventInfo) {
        row.push('');
      } else {
        let attending = eventInfo.attendeeIds.some(x => x === personId);
        if (updateEventAttendees(eventInfo, updatingExistingData)) {
          row.push(attending ? 'y' : 'n');
        } else {
          row.push(attending ? 'y (dup)' : '');
        }
      }
    });
    matrixRows.push(row);
  });

  printLine();
  console.log(`Table for google sheet`);
  matrixRows.forEach(row => {
    console.log(row.join("\t"))
  });
});
